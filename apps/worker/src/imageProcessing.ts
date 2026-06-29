import sharp from "sharp";

export async function createPreview(input: Buffer, width: number, height: number) {
  return sharp(input)
    .resize({ width, height, fit: "cover" })
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function normalizeFinal(input: Buffer, width: number, height: number) {
  return sharp(input)
    .resize({ width, height, fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
