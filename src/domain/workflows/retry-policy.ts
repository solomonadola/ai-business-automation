export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  const transientIndicators = [
    "timeout",
    "timed out",
    "econnreset",
    "etimedout",
    "econnrefused",
    "429",
    "rate limit",
    "500",
    "502",
    "503",
    "504",
    "temporary failure",
    "network error",
    "abort",
  ];

  return transientIndicators.some((indicator) => msg.includes(indicator));
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;

  let lastError: Error = new Error("Unknown operation failure");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const isTransient = isTransientError(lastError);
      if (!isTransient || attempt === maxRetries) {
        throw lastError;
      }

      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }

      // Exponential backoff
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 3000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
