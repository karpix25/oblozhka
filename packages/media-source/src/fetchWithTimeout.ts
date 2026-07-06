export type FetchTextOptions = {
  description: string;
  signal?: AbortSignal;
  timeoutMs: number;
  attempts?: number;
};

export async function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchTextOptions
): Promise<{ ok: boolean; status: number; text: string }> {
  const attempts = options.attempts ?? 2;
  let lastResponse: { ok: boolean; status: number; text: string } | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchOnceWithTimeout(url, init, options);
      if (response.ok || !isRetryableStatus(response.status) || attempt === attempts) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || isAbortError(error) || isTimeoutError(error) || attempt === attempts) {
        throw error;
      }
    }
    await sleep(attempt * 250, options.signal);
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error(`${options.description} failed.`);
}

function fetchOnceWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchTextOptions
): Promise<{ ok: boolean; status: number; text: string }> {
  return withTimeoutSignal(options, async (signal) => {
    const response = await fetch(url, { ...init, signal });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text()
    };
  });
}

function withTimeoutSignal<T>(
  options: FetchTextOptions,
  action: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  const abortFromParent = () => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    abortFromParent();
  } else {
    options.signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return action(controller.signal)
    .catch((error) => {
      if (timedOut) {
        throw new Error(`${options.description} timed out after ${options.timeoutMs}ms.`, { cause: error });
      }
      if (isAbortError(error) || options.signal?.aborted) {
        throw new Error(`${options.description} was aborted.`, { cause: error });
      }
      throw error;
    })
    .finally(() => {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromParent);
    });
}

export function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(" timed out after ");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("Media source request was aborted."));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Media source request was aborted."));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
