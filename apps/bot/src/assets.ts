import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const assetRoot = join(currentDir, "..", "assets");

export function onboardingImagePath() {
  return join(assetRoot, "onboarding.png");
}

export function faceUploadGuidePath() {
  return join(assetRoot, "face-upload-guide.png");
}

export function templatePreviewPath(slug: string) {
  return join(assetRoot, "templates", `${slug}.png`);
}
