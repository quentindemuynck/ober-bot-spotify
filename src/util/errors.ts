export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

export class AiParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiParseError";
  }
}

export class ResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResolutionError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isKnownError(
  err: unknown
): err is SpotifyApiError | AiParseError | ResolutionError | ValidationError {
  return (
    err instanceof SpotifyApiError ||
    err instanceof AiParseError ||
    err instanceof ResolutionError ||
    err instanceof ValidationError
  );
}
