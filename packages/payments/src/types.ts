export type PaymentCurrency = "RUB";

export type PaymentProvider = "PLATEGA";

export type PlategaPaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELED"
  | "CHARGEBACKED"
  | "REFUNDED"
  | "FAILED"
  | string;

export type PlategaTransaction = {
  transactionId: string;
  status: PlategaPaymentStatus;
  url: string;
  expiresIn?: string;
  rate?: number;
  raw: unknown;
};

export type PlategaTransactionStatus = {
  id: string;
  status: PlategaPaymentStatus;
  amount: number;
  currency: PaymentCurrency;
  paymentMethod?: string | number;
  payload?: string;
  raw: unknown;
};

export type PlategaCallbackPayload = {
  id: string;
  amount: number;
  currency: PaymentCurrency;
  status: PlategaPaymentStatus;
  paymentMethod?: string | number;
};
