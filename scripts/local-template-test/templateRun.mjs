import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { templateDisplayName } from "@covers/domain";
import sharp from "sharp";
import { templatePreviewPath, uploadLocalFile } from "./assets.mjs";
import { reviewPair } from "./review.mjs";

export async function runTemplate(input) {
  const templatePath = templatePreviewPath(input.repoRoot, input.template.slug);
  try {
    const templateUrl = await uploadLocalFile(input.storage, {
      path: templatePath,
      key: `local-tests/${input.runId}/templates/${input.template.slug}.png`,
      contentType: "image/png"
    });
    const hook = await firstHook(input.promptPlanner, input);
    const plan = await planPrompt(input, hook, templateUrl);
    const outputPath = await generateImage(input, plan, templateUrl);
    const generatedUrl = await uploadGenerated(input, outputPath);
    const review = await reviewPair({ template: input.template, templateUrl, generatedUrl, hook });

    return templateResult(input, { hook, templatePath, outputPath, templateUrl, generatedUrl, prompt: plan.prompt, review });
  } catch (error) {
    console.error(`local-test: ${input.template.title} failed`, error);
    return templateResult(input, {
      hook: "",
      templatePath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function firstHook(planner, input) {
  const hooks = await planner.generateHooks({
    transcript: input.transcript,
    platform: "YOUTUBE",
    templateTitle: input.template.title,
    templateRules: input.template.promptRules
  });
  return hooks[0]?.text ?? "СМОТРИ ЧТО ВЫШЛО";
}

async function planPrompt(input, hook, templateUrl) {
  return input.promptPlanner.plan({
    wizard: {
      format: "YOUTUBE",
      referenceMode: "FACE",
      referenceImageUrl: input.faceUrl,
      topic: input.transcript.slice(0, 1200),
      niche: "YOUTUBE",
      hookText: hook,
      style: input.template.title,
      templateSlug: input.template.slug
    },
    formatDescription: input.spec.description,
    aspectRatio: input.spec.aspectRatio,
    template: {
      slug: input.template.slug,
      title: input.template.title,
      promptRules: input.template.promptRules
    },
    templateReferenceImageUrl: templateUrl
  });
}

async function generateImage(input, plan, templateUrl) {
  const generated = await input.imageClient.generate({
    prompt: plan.prompt,
    imageUrls: [input.faceUrl, templateUrl],
    aspectRatio: input.spec.aspectRatio,
    resolution: "1K"
  });
  const finalImage = await sharp(generated.bytes)
    .resize({ width: input.spec.width, height: input.spec.height, fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const outputPath = join(input.outputDir, `${String(input.index + 1).padStart(2, "0")}-${input.template.slug}.png`);
  await writeFile(outputPath, finalImage);
  return outputPath;
}

async function uploadGenerated(input, outputPath) {
  return input.storage.uploadBuffer({
    key: `local-tests/${input.runId}/generated/${input.template.slug}.png`,
    body: await sharp(outputPath).png().toBuffer(),
    contentType: "image/png"
  });
}

function templateResult(input, data) {
  return {
    index: input.index + 1,
    slug: input.template.slug,
    title: templateDisplayName(input.template.slug, input.template.title),
    technicalTitle: input.template.title,
    ...data
  };
}
