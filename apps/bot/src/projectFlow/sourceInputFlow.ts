import type { SourceType } from "@covers/domain";
import { sourceStartMessage } from "../messages.js";
import type { BotContext, WizardStep } from "../session.js";

type ClassifiedTextSource =
  | { sourceType: "LINK"; source: { url: string } }
  | { sourceType: "TRANSCRIPT"; source: { text: string } };

export async function promptForSourceInput(ctx: BotContext) {
  ctx.session.step = "sourceInput";
  ctx.session.sourceType = undefined;
  await ctx.reply(sourceStartMessage());
}

export function classifyTextSource(rawText: string): ClassifiedTextSource | null {
  const text = rawText.trim();
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) {
    return { sourceType: "LINK", source: { url: text } };
  }

  return { sourceType: "TRANSCRIPT", source: { text } };
}

export function canAcceptVideoSource(step: WizardStep) {
  return step === "sourceInput" || step === "sourceVideo";
}

export function sourceStepForType(sourceType: SourceType): WizardStep {
  if (sourceType === "LINK") return "sourceLink";
  if (sourceType === "VIDEO") return "sourceVideo";
  return "sourceTranscript";
}
