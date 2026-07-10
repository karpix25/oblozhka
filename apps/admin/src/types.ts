export type User = {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  balance: number;
  status: string;
  lastSeenAt?: string;
  createdAt: string;
};

export type CreditPackage = {
  id: string;
  slug?: string;
  plan?: "START" | "PRO" | "BUSINESS";
  title: string;
  description?: string;
  priceRub: number;
  credits: number;
  isActive: boolean;
};

export type Payment = {
  id: string;
  status: string;
  amountRub: number;
  currency: string;
  providerTransactionId?: string;
  providerStatus?: string;
  paymentUrl?: string;
  creditsGranted: number;
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

export type AdminAnalyticsSummary = {
  generatedAt: string;
  users: {
    total: number;
    new: WindowCounts;
    active: WindowCounts;
  };
  generations: {
    total: number;
    byStatus: Record<"QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED", number>;
  };
  payments: {
    successfulCount: number;
    revenueRub: number;
    averageCheckRub: number;
  };
  subscriptions: {
    activeByPlan: Record<"START" | "PRO" | "BUSINESS", number>;
  };
  cjm?: CjmAnalytics;
};

export type PercentileMetric = {
  sampleSize: number;
  p50Ms: number | null;
  p90Ms: number | null;
};

export type CjmAnalytics = {
  windowDays: number;
  funnel: Array<{
    name: string;
    count: number;
    conversionFromPrevious: number | null;
    conversionFromStart: number | null;
  }>;
  journeyDurations: {
    sourceToTemplates: PercentileMetric;
    hooksPreparation: PercentileMetric;
    timeToGeneration: PercentileMetric;
  };
  generationDurations: {
    queue: PercentileMetric;
    processing: PercentileMetric;
    total: PercentileMetric;
  };
};

export type WindowCounts = {
  today: number;
  last7Days: number;
  last30Days: number;
};
