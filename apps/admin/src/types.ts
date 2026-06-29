export type User = {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  balance: number;
  status: string;
  createdAt: string;
};

export type CreditPackage = {
  id: string;
  title: string;
  description?: string;
  starsPrice: number;
  credits: number;
  isActive: boolean;
};

export type Payment = {
  id: string;
  status: string;
  starsAmount: number;
  creditsGranted: number;
  telegramPaymentChargeId?: string;
  createdAt: string;
  user?: User;
  package?: CreditPackage;
};

export type Generation = {
  id: string;
  status: string;
  format: string;
  topic: string;
  niche: string;
  style: string;
  errorMessage?: string;
  createdAt: string;
  user?: User;
};

export type PromptPreset = {
  id: string;
  slug: string;
  title: string;
  niche: string;
  style: string;
  promptTemplate: string;
  isActive: boolean;
};
