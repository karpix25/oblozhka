import type { PaymentCurrency, PlategaCallbackPayload, PlategaTransaction, PlategaTransactionStatus } from "./types.js";

type PlategaConfig = {
  baseUrl?: string;
  merchantId?: string;
  secret?: string;
  timeoutMs?: number;
};

export type CreatePlategaTransactionInput = {
  amountRub: number;
  description: string;
  returnUrl: string;
  failedUrl: string;
  payload: string;
  metadata: {
    userId: string;
    userName?: string;
  };
};

const DEFAULT_BASE_URL = "https://app.platega.io/";
const RUB: PaymentCurrency = "RUB";

export class PlategaClient {
  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(config: PlategaConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.PLATEGA_BASE_URL ?? DEFAULT_BASE_URL;
    this.merchantId = config.merchantId ?? process.env.PLATEGA_MERCHANT_ID ?? "";
    this.secret = config.secret ?? process.env.PLATEGA_SECRET ?? "";
    this.timeoutMs = config.timeoutMs ?? positiveNumber(process.env.PLATEGA_TIMEOUT_MS, 30000);
  }

  async createTransaction(input: CreatePlategaTransactionInput, options: { signal?: AbortSignal } = {}): Promise<PlategaTransaction> {
    this.assertConfigured();
    assertPositiveRubAmount(input.amountRub);
    const response = await fetchPlategaText(
      this.url("v2/transaction/process"),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          paymentDetails: {
            amount: input.amountRub,
            currency: RUB
          },
          description: input.description,
          return: input.returnUrl,
          failedUrl: input.failedUrl,
          payload: input.payload,
          metadata: input.metadata
        })
      },
      {
        description: "Platega create transaction",
        signal: options.signal,
        timeoutMs: this.timeoutMs,
        attempts: 1
      }
    );

    const raw = parseJsonResponse(response.text);
    if (!response.ok) {
      throw new Error(`Platega create transaction failed: ${response.status} ${JSON.stringify(raw)}`);
    }

    const body = raw as {
      transactionId?: string;
      status?: string;
      url?: string;
      redirect?: string;
      expiresIn?: string;
      rate?: number;
      usdtRate?: number;
    };
    const paymentUrl = body.url ?? body.redirect;
    if (!body.transactionId || !paymentUrl || !body.status) {
      throw new Error("Platega create transaction response is missing transactionId, status or payment URL.");
    }
    return {
      transactionId: body.transactionId,
      status: body.status,
      url: paymentUrl,
      expiresIn: body.expiresIn,
      rate: body.rate ?? body.usdtRate,
      raw
    };
  }

  async getTransaction(transactionId: string, options: { signal?: AbortSignal } = {}): Promise<PlategaTransactionStatus> {
    this.assertConfigured();
    const response = await fetchPlategaText(
      this.url(`transaction/${encodeURIComponent(transactionId)}`),
      {
        method: "GET",
        headers: this.headers()
      },
      {
        description: "Platega status check",
        signal: options.signal,
        timeoutMs: this.timeoutMs,
        attempts: 2
      }
    );
    const raw = parseJsonResponse(response.text);
    if (!response.ok) {
      throw new Error(`Platega status check failed: ${response.status} ${JSON.stringify(raw)}`);
    }
    return normalizePlategaStatus(raw);
  }

  verifyCallbackHeaders(headers: { merchantId?: string; secret?: string }) {
    this.assertConfigured();
    return headers.merchantId === this.merchantId && headers.secret === this.secret;
  }

  private headers() {
    return {
      "X-MerchantId": this.merchantId,
      "X-Secret": this.secret,
      "Content-Type": "application/json"
    };
  }

  private url(path: string) {
    return new URL(path.replace(/^\/+/, ""), this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`).toString();
  }

  private assertConfigured() {
    if (!this.merchantId || !this.secret) {
      throw new Error("Platega credentials are not configured.");
    }
  }
}

export function normalizePlategaCallback(input: PlategaCallbackPayload): PlategaTransactionStatus {
  return {
    id: input.id,
    status: input.status,
    amount: input.amount,
    currency: input.currency,
    paymentMethod: input.paymentMethod,
    raw: input
  };
}

function normalizePlategaStatus(raw: unknown): PlategaTransactionStatus {
  const body = raw as {
    id?: string;
    status?: string;
    paymentDetails?: { amount?: number; currency?: PaymentCurrency };
    amount?: number;
    currency?: PaymentCurrency;
    paymentMethod?: string | number;
    payload?: string;
  };
  const amount = body.paymentDetails?.amount ?? body.amount;
  const currency = body.paymentDetails?.currency ?? body.currency;
  if (!body.id || !body.status || typeof amount !== "number" || currency !== RUB) {
    throw new Error("Platega transaction status response is invalid.");
  }
  return {
    id: body.id,
    status: body.status,
    amount,
    currency,
    paymentMethod: body.paymentMethod,
    payload: body.payload,
    raw
  };
}

function assertPositiveRubAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Platega amountRub must be a positive integer.");
  }
}

async function fetchPlategaText(
  url: string,
  init: RequestInit,
  options: { description: string; signal?: AbortSignal; timeoutMs: number; attempts: number }
): Promise<{ ok: boolean; status: number; text: string }> {
  let lastResponse: { ok: boolean; status: number; text: string } | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const response = await fetchTextWithTimeout(url, init, options);
      if (response.ok || !isRetryableStatus(response.status) || attempt === options.attempts) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || isAbortError(error) || isTimeoutError(error) || attempt === options.attempts) {
        throw error;
      }
    }
    await sleep(attempt * 250, options.signal);
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error(`${options.description} failed.`);
}

function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  options: { description: string; signal?: AbortSignal; timeoutMs: number }
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
  options: { description: string; signal?: AbortSignal; timeoutMs: number },
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

function parseJsonResponse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text };
  }
}

function positiveNumber(value: string | undefined, fallback: number): number {
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
    return Promise.reject(new Error("Platega request was aborted."));
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
      reject(new Error("Platega request was aborted."));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
