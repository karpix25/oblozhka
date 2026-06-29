import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const templateDir = new URL("../apps/bot/assets/templates/", import.meta.url);
const onboardingSource = new URL("../brand/assets/hookcover-bot-cover-1280.png", import.meta.url);
const onboardingTarget = new URL("../apps/bot/assets/onboarding.png", import.meta.url);

const cards = [
  ["faceless-pov", "Faceless POV", "FACELESS", "#101216", "#F9D84A", "POV", "START EARNING"],
  ["split-text", "Split Text", "YOUTUBE", "#0B1B2B", "#FF3B30", "2175", "COMING"],
  ["double-focus-arrow", "Double Focus Arrow", "YOUTUBE", "#0F5132", "#F9D84A", "A -> B", "WHY NOW"],
  ["foreground-focus", "Foreground Focus", "INSTAGRAM/TIKTOK", "#1F2937", "#25D7F7", "CLOSE-UP", "WOW"],
  ["center-object-text", "Center Object Text", "FACELESS", "#F8FAFC", "#101216", "OBJECT", "I OWN"],
  ["skewed-hero-text", "Skewed Hero Text", "YOUTUBE", "#203040", "#FF3B30", "HIJACKED", "STORY"],
  ["subject-circle-highlight", "Subject Circle Highlight", "YOUTUBE", "#16351F", "#F9D84A", "HIDDEN", "LOOK HERE"],
  ["split-compare", "Split Compare", "INSTAGRAM/TIKTOK", "#E9EEF2", "#101216", "BEFORE / AFTER", "RESULT"]
];

await fs.mkdir(templateDir, { recursive: true });
await fs.copyFile(onboardingSource, onboardingTarget);

for (const [slug, title, platform, bg, accent, big, small] of cards) {
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
