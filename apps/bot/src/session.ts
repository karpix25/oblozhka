import type { WizardInput } from "@covers/domain";
import type { Context, SessionFlavor } from "grammy";

export type WizardStep = "idle" | "sourceLink" | "sourceTranscript" | "sourceVideo" | "referenceUpload" | "topic" | "hook";

export type BotSession = {
  step: WizardStep;
  projectId?: string;
  templateGalleryMode?: "browse" | "select";
  draft?: Partial<WizardInput>;
};

export type BotContext = Context & SessionFlavor<BotSession>;

export function initialSession(): BotSession {
  return { step: "idle" };
}

export function resetWizard(ctx: BotContext) {
  ctx.session.step = "idle";
  ctx.session.projectId = undefined;
  ctx.session.templateGalleryMode = undefined;
  ctx.session.draft = undefined;
}
