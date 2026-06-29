import type { CoverFormat } from "./types.js";

export type FormatSpec = {
  label: string;
  aspectRatio: string;
  size: string;
  width: number;
  height: number;
  description: string;
};

export const FORMAT_SPECS: Record<CoverFormat, FormatSpec> = {
  YOUTUBE: {
    label: "YouTube обложка",
    aspectRatio: "16:9",
    size: "2048x1152",
    width: 2048,
    height: 1152,
    description: "горизонтальная обложка для YouTube"
  },
  VERTICAL: {
    label: "Вертикальная обложка",
    aspectRatio: "9:16",
    size: "1152x2048",
    width: 1152,
    height: 2048,
    description: "вертикальная обложка для Shorts/Reels/TikTok"
  }
};

export function getFormatSpec(format: CoverFormat): FormatSpec {
  return FORMAT_SPECS[format];
}
