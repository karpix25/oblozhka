import sharp from "sharp";
import fs from "node:fs/promises";

const dir = process.argv[2] ?? "brand/style-tests/youtube-2026-06-28";
const items = [
  ["01-podcast", "Podcast"],
  ["02-center-stage", "Center Stage"],
  ["03-podcast-countdown", "Podcast Countdown"],
  ["04-simple-text", "Simple Text"],
  ["05-whiteboard", "Whiteboard"],
  ["06-text-on-image", "Text On Image"],
  ["07-history", "History"],
  ["08-explainer", "Explainer"],
  ["09-object-in-hand", "Object In Hand"],
  ["10-contextual-background", "Contextual Background"],
  ["11-before-after", "Before/After"]
];

const cols = 3;
const tileWidth = 480;
const tileHeight = 270;
const labelHeight = 42;
const gap = 18;
const cellHeight = tileHeight + labelHeight;
const rows = Math.ceil(items.length / cols);
const width = cols * tileWidth + (cols + 1) * gap;
const height = rows * cellHeight + (rows + 1) * gap;

const composites = [];

for (let index = 0; index < items.length; index += 1) {
  const [slug, label] = items[index];
  const col = index % cols;
  const row = Math.floor(index / cols);
  const left = gap + col * (tileWidth + gap);
  const top = gap + row * (cellHeight + gap);
  const imagePath = await existingImagePath(slug);
  const image = await sharp(imagePath).resize(tileWidth, tileHeight, { fit: "cover" }).png().toBuffer();
  const caption = Buffer.from(labelSvg(`${String(index + 1).padStart(2, "0")} ${label}`));
  composites.push({ input: image, left, top }, { input: caption, left, top: top + tileHeight });
}

await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: "#0f0f0f"
  }
})
  .composite(composites)
  .png()
  .toFile(`${dir}/contact-sheet.png`);

function labelSvg(text) {
  return `
    <svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#191919"/>
      <text x="18" y="28" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${escapeXml(text)}</text>
    </svg>
  `;
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function existingImagePath(slug) {
  const normalized = `${dir}/${slug}-1280x720.png`;
  const raw = `${dir}/${slug}.png`;
  try {
    await fs.access(normalized);
    return normalized;
  } catch {
    return raw;
  }
}
