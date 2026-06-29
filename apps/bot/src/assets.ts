import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const assetRoot = join(currentDir, "..", "assets");

export function onboardingImagePath() {
  return join(assetRoot, "onboarding.png");
}

export function templatePreviewPath(slug: string) {
  return join(assetRoot, "templates", `${slug}.png`);
}
