import type { PaymentCurrency, PlategaCallbackPayload, PlategaTransaction, PlategaTransactionStatus } from "./types.js";

type PlategaConfig = {
  baseUrl?: string;
  merchantId?: string;
  secret?: string;
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

  constructor(config: PlategaConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.PLATEGA_BASE_URL ?? DEFAULT_BASE_URL;
    this.merchantId = config.merchantId ?? process.env.PLATEGA_MERCHANT_ID ?? "";
    this.secret = config.secret ?? process.env.PLATEGA_SECRET ?? "";
  }

  async createTransaction(input: CreatePlategaTransactionInput): Promise<PlategaTransaction> {
    this.assertConfigured();
    assertPositiveRubAmount(input.amountRub);
    const response = await fetch(this.url("v2/transaction/process"), {
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
    });

    const raw = await response.json().catch(async () => ({ error: await response.text() }));
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

  async getTransaction(transactionId: string): Promise<PlategaTransactionStatus> {
    this.assertConfigured();
    const response = await fetch(this.url(`transaction/${encodeURIComponent(transactionId)}`), {
      method: "GET",
      headers: this.headers()
    });
    const raw = await response.json().catch(async () => ({ error: await response.text() }));
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
