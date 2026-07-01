export const TELEGRAM_STARS_CURRENCY = "XTR";

export type InvoicePayload = {
  packageId: string;
  userId: string;
  nonce: string;
};

export type StarsInvoice = {
  title: string;
  description: string;
  payload: string;
  currency: typeof TELEGRAM_STARS_CURRENCY;
  prices: Array<{ label: string; amount: number }>;
  provider_token: "";
};

export type SuccessfulPayment = {
  invoicePayload: string;
  telegramPaymentChargeId: string;
  providerPaymentChargeId?: string;
  totalAmount: number;
  currency: string;
  raw: object;
};

export function encodeInvoicePayload(payload: InvoicePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeInvoicePayload(payload: string): InvoicePayload {
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(decoded) as InvoicePayload;
}

export function createStarsInvoice(input: {
  title: string;
  description?: string;
  starsPrice: number;
  credits: number;
  payload: string;
}): StarsInvoice {
  return {
    title: input.title,
    description: input.description ?? `${input.credits} обложек`,
    payload: input.payload,
    currency: TELEGRAM_STARS_CURRENCY,
    provider_token: "",
    prices: [{ label: input.title, amount: input.starsPrice }]
  };
}

export function normalizeSuccessfulPayment(payment: {
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id?: string;
  total_amount: number;
  currency: string;
}): SuccessfulPayment {
  return {
    invoicePayload: payment.invoice_payload,
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
    providerPaymentChargeId: payment.provider_payment_charge_id,
    totalAmount: payment.total_amount,
    currency: payment.currency,
    raw: payment
  };
}
