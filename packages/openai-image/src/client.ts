import OpenAI from "openai";

export type ImageClientConfig = {
  apiKey?: string;
  model?: string;
};

export type GeneratedImage = {
  bytes: Buffer;
  model: string;
  revisedPrompt?: string;
};

export class OpenAiImageClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ImageClientConfig = {}) {
    this.client = new OpenAI({ apiKey: config.apiKey ?? process.env.OPENAI_API_KEY });
    this.model = config.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  }

  async generate(input: { prompt: string; size: string; quality?: "low" | "medium" | "high" }) {
    const result = await this.client.images.generate({
      model: this.model,
      prompt: input.prompt,
      size: input.size as never,
      quality: input.quality ?? "medium"
    });

    const image = result.data?.[0];
    if (!image?.b64_json) {
      throw new Error("OpenAI did not return image bytes.");
    }

    return {
      bytes: Buffer.from(image.b64_json, "base64"),
      model: this.model,
      revisedPrompt: image.revised_prompt
    } satisfies GeneratedImage;
  }
}
