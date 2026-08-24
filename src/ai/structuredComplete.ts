import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import { zodResponseFormat } from "openai/helpers/zod.js";
import OpenAI from "openai";
import type { z } from "zod";
import { AiParseError } from "../util/errors.js";
import { logger } from "../util/logger.js";
import { sleep } from "../util/retry.js";
import { MODEL, openai } from "./openaiClient.js";

const MAX_VALIDATION_ATTEMPTS = 2;
const MAX_RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_BASE_DELAY_MS = 5_000;

function rateLimitDelayMs(err: InstanceType<typeof OpenAI.RateLimitError>, retryCount: number): number {
  const retryAfterHeader = err.headers?.["retry-after"];
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return RATE_LIMIT_BASE_DELAY_MS * 2 ** retryCount;
}

/**
 * Runs a structured (JSON-schema validated) chat completion. Rate limit (429) errors are
 * retried with backoff (honoring Retry-After when present) on a separate budget from
 * schema-validation retries, since a 429 isn't something re-prompting the model can fix.
 */
export async function structuredComplete<T extends z.ZodTypeAny>(params: {
  schema: T;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<z.infer<T>> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: params.systemPrompt },
    { role: "user", content: params.userPrompt },
  ];

  let lastError: unknown;
  let rateLimitRetries = 0;

  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
    try {
      const completion = await openai.beta.chat.completions.parse({
        model: MODEL,
        messages,
        response_format: zodResponseFormat(params.schema, params.schemaName),
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        throw new AiParseError(`Model returned no parsed content for ${params.schemaName}`);
      }
      return parsed;
    } catch (err) {
      lastError = err;

      if (err instanceof OpenAI.RateLimitError && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
        const delayMs = rateLimitDelayMs(err, rateLimitRetries);
        rateLimitRetries++;
        logger.warn("AI provider rate limited, backing off", {
          schemaName: params.schemaName,
          delayMs,
          rateLimitRetries,
        });
        await sleep(delayMs);
        attempt--; // don't consume a validation-retry attempt for a rate limit
        continue;
      }

      logger.warn("Structured completion failed, will retry if attempts remain", {
        schemaName: params.schemaName,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      messages.push({
        role: "user",
        content: `Your previous response was invalid: ${
          err instanceof Error ? err.message : String(err)
        }. Please respond again, strictly matching the required schema.`,
      });
    }
  }

  const lastErrorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  throw new AiParseError(
    `Failed to get valid structured output for ${params.schemaName}: ${lastErrorMessage}`,
    lastError
  );
}
