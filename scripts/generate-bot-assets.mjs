import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const templateDir = new URL("../apps/bot/assets/templates/", import.meta.url);
const onboardingSource = new URL("../brand/assets/hookcover-bot-cover-1280.png", import.meta.url);
const onboardingTarget = new URL("../apps/bot/assets/onboarding.png", import.meta.url);
const youtubeReferenceDir = new URL("../brand/reference-styles/youtube/", import.meta.url);

const youtubeReferences = [
  ["01-podcast.png", "podcast"],
  ["02-center-stage.png", "center-stage"],
  ["03-podcast-countdown.png", "podcast-countdown"],
  ["04-simple-text.png", "simple-text"],
  ["05-whiteboard.png", "whiteboard"],
  ["06-text-on-image.png", "text-on-image"],
  ["07-history.png", "history"],
  ["08-explainer.png", "explainer"],
  ["09-object-in-hand.png", "object-in-hand"],
  ["10-contextual-background.png", "contextual-background"],
  ["11-before-after.png", "before-after"]
];

const fallbackCards = [
  ["faceless-pov", "Faceless POV", "FACELESS", "#101216", "#F9D84A", "POV", "START EARNING"],
  ["foreground-focus", "Foreground Focus", "REELS/TIKTOK", "#1F2937", "#25D7F7", "CLOSE-UP", "WOW"],
  ["center-object-text", "Center Object Text", "FACELESS", "#F8FAFC", "#101216", "OBJECT", "I OWN"],
  ["split-compare", "Split Compare", "REELS/TIKTOK", "#E9EEF2", "#101216", "BEFORE / AFTER", "RESULT"]
];

await fs.mkdir(templateDir, { recursive: true });
await fs.copyFile(onboardingSource, onboardingTarget);

for (const [sourceName, slug] of youtubeReferences) {
  await sharp(fileURLToPath(new URL(sourceName, youtubeReferenceDir)))
    .resize(1280, 720, { fit: "cover" })
    .png()
    .toFile(fileURLToPath(new URL(`${slug}.png`, templateDir)));
}

for (const [slug, title, platform, bg, accent, big, small] of fallbackCards) {
  const svg = templateSvg({ title, platform, bg, accent, big, small });
  await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(`${slug}.png`, templateDir)));
}

function templateSvg({ title, platform, bg, accent, big, small }) {
  const lightText = bg === "#F8FAFC" || bg === "#E9EEF2" ? "#101216" : "#FFFFFF";
  const mutedText = bg === "#F8FAFC" || bg === "#E9EEF2" ? "#4B5563" : "#FFFFFF";
  return `
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
      <rect width="1280" height="720" fill="${bg}"/>
      <rect x="48" y="48" width="1184" height="624" rx="34" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
      <circle cx="1030" cy="190" r="96" fill="${accent}" opacity="0.92"/>
      <rect x="760" y="410" width="360" height="74" rx="18" fill="${accent}"/>
      <path d="M760 260 C900 210 1008 290 1136 226" fill="none" stroke="${accent}" stroke-width="24" stroke-linecap="round"/>
      <path d="M1106 184 L1164 216 L1117 259" fill="none" stroke="${accent}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="88" y="172" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700" fill="${mutedText}" opacity="0.78">${escapeXml(platform)}</text>
      <text x="88" y="330" font-family="Arial, Helvetica, sans-serif" font-size="118" font-weight="900" fill="${lightText}">${escapeXml(big)}</text>
      <text x="88" y="442" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="900" fill="${accent}">${escapeXml(small)}</text>
      <text x="88" y="610" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="${lightText}">${escapeXml(title)}</text>
    </svg>
  `;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
