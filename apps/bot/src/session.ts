import type { SourceType, WizardInput } from "@covers/domain";
import type { Context, SessionFlavor } from "grammy";

export type WizardStep =
  | "idle"
  | "sourceInput"
  | "sourceLink"
  | "sourceTranscript"
  | "sourceVideo"
  | "guestFaceUpload"
  | "referenceUpload"
  | "styleUpload"
  | "modernizationPrompt"
  | "topic"
  | "hook";

export type BotSession = {
  step: WizardStep;
  projectId?: string;
  sourceType?: SourceType;
  templateGalleryMode?: "browse" | "select";
  faceGalleryMode?: "browse" | "reference" | "guest";
  modernization?: { generationId: string; actionId: string };
  draft?: Partial<WizardInput>;
};

export type BotContext = Context & SessionFlavor<BotSession>;

export function initialSession(): BotSession {
  return { step: "idle" };
}

export function resetWizard(ctx: BotContext) {
  ctx.session.step = "idle";
  ctx.session.projectId = undefined;
  ctx.session.sourceType = undefined;
  ctx.session.templateGalleryMode = undefined;
  ctx.session.faceGalleryMode = undefined;
  ctx.session.modernization = undefined;
  ctx.session.draft = undefined;
}
