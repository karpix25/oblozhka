import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TEMPLATES, getFormatSpec } from "@covers/domain";
import { KieImageClient, OpenRouterPromptPlanner } from "@covers/generation-ai";
import { SourceIngestionService } from "@covers/media-source";
import { ObjectStorage } from "@covers/storage";
import { uploadLocalFile } from "./local-template-test/assets.mjs";
import { contentTypeFor, derivePublicStorageUrl, loadEnvFile, parseArgs } from "./local-template-test/env.mjs";
import { writeReport } from "./local-template-test/report.mjs";
import { runTemplate } from "./local-template-test/templateRun.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..");

await loadEnvFile(join(repoRoot, ".env"));
derivePublicStorageUrl();

const args = parseArgs(process.argv.slice(2));
const reelUrl = args.url ?? "https://www.instagram.com/reels/DaHShnGtk0G/";
const facePath = resolve(args.face ?? "");
if (!args.face || !existsSync(facePath)) {
  throw new Error("--face must point to a local face reference image.");
}

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = resolve(args.out ?? join(repoRoot, "dist", "local-template-tests", runId));
mkdirSync(outputDir, { recursive: true });

const clients = {
  storage: new ObjectStorage(),
  promptPlanner: new OpenRouterPromptPlanner(),
  imageClient: new KieImageClient(),
  ingestion: new SourceIngestionService()
};
const spec = getFormatSpec("YOUTUBE");
const templates = DEFAULT_TEMPLATES.filter((template) => template.platform === "YOUTUBE");

console.log(`local-test: output=${outputDir}`);
console.log("local-test: resolving transcript");
const transcript = await resolveTranscript(clients.ingestion, reelUrl);
await writeFile(join(outputDir, "transcript.txt"), transcript);
console.log(`local-test: transcript chars=${transcript.length}`);

console.log("local-test: uploading face reference");
const faceUrl = await uploadLocalFile(clients.storage, {
  path: facePath,
  key: `local-tests/${runId}/references/face-${basename(facePath)}`,
  contentType: contentTypeFor(facePath)
});

const results = [];
for (const [index, template] of templates.entries()) {
  console.log(`local-test: [${index + 1}/${templates.length}] ${template.title}`);
  results.push(await runTemplate({ index, template, transcript, faceUrl, repoRoot, outputDir, runId, spec, ...clients }));
  await writeCurrentReport(results);
}

await writeCurrentReport(results);
await writeFile(join(outputDir, "results.json"), JSON.stringify(results, null, 2));
console.log(`local-test: done ${join(outputDir, "index.html")}`);

async function resolveTranscript(service, url) {
  const result = await service.resolveTranscript({ sourceType: "LINK", url });
  if (!result?.text) throw new Error("Transcript was not resolved.");
  return result.text;
}

async function writeCurrentReport(results) {
  await writeReport(outputDir, results, {
    reelUrl,
    facePath,
    transcriptLength: transcript.length
  });
}
