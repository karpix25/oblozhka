export type PaymentPayload = {
  packageId: string;
  userId: string;
  nonce: string;
};

export function encodePaymentPayload(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePaymentPayload(payload: string): PaymentPayload {
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(decoded) as PaymentPayload;
}
