export type CoverFormat = "YOUTUBE" | "VERTICAL";

export type ReferenceMode = "FACE" | "REFERENCE" | "NONE";

export type SourceType = "LINK" | "VIDEO" | "TRANSCRIPT";

export type ProjectPlatform = "YOUTUBE" | "INSTAGRAM_TIKTOK" | "FACELESS";

export type ProjectStatus =
  | "DRAFT"
  | "SOURCE_READY"
  | "HOOKS_PENDING"
  | "HOOKS_READY"
  | "GENERATION_PENDING"
  | "COMPLETED"
  | "FAILED";

export type GenerationStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export type LedgerReason =
  | "PURCHASE"
  | "GENERATION_DEBIT"
  | "GENERATION_REFUND"
  | "MANUAL_ADJUSTMENT";

export type UserProfile = {
  telegramId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
};

export type CreditPackageInput = {
  title: string;
  description?: string;
  starsPrice: number;
  credits: number;
  isActive?: boolean;
};

export type WizardInput = {
  format: CoverFormat;
  referenceMode: ReferenceMode;
  referenceImageUrl?: string;
  guestReferenceImageUrl?: string;
  platform?: ProjectPlatform;
  templateSlug?: string;
  topic: string;
  niche: string;
  hookText?: string;
  style: string;
};

export type GenerationJobData = {
  generationId: string;
  userTelegramId: number;
};

export type HookJobData = {
  projectId: string;
  userTelegramId: number;
};

export type SourceJobData = {
  projectId: string;
  userTelegramId: number;
};
