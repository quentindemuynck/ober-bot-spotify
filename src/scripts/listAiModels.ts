import { openai } from "../ai/openaiClient.js";

async function main() {
  const models = await openai.models.list();
  const ids = models.data.map((m) => m.id).sort();
  console.log(`${ids.length} model(s) available for this AI_API_KEY / AI_BASE_URL:`);
  for (const id of ids) console.log(`  - ${id}`);
}

main().catch((err) => {
  console.error("Failed to list models:", err);
  process.exit(1);
});
