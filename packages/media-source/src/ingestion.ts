import type { SourceType } from "@covers/domain";
import { DeepgramTranscriptionClient } from "./deepgram.js";
import { ScrapeCreatorsClient } from "./scrapeCreators.js";
import type { TranscriptResult } from "./types.js";

export class SourceIngestionService {
  private readonly scrapeCreators = new ScrapeCreatorsClient();
  private readonly deepgram = new DeepgramTranscriptionClient();

  async resolveTranscript(input: { sourceType: SourceType; url?: string; text?: string }) {
    if (input.sourceType === "TRANSCRIPT" && input.text) {
      return { text: input.text, provider: "user", raw: { sourceType: input.sourceType } } satisfies TranscriptResult;
    }

    if (input.sourceType === "LINK" && input.url) {
      const socialTranscript = await this.scrapeCreators.transcriptFromUrl(input.url);
      if (socialTranscript) return socialTranscript;
    }

    if (input.url) {
      return this.deepgram.transcribeUrl(input.url);
    }

    return undefined;
  }
}
