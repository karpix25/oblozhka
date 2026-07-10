export type DesignTextConstraints = {
  maxWords?: number;
  textPlacement?: string;
  typography?: string;
  textRole?: string;
  requiresGuestFace: boolean;
  summary: string;
};

export function deriveDesignTextConstraints(input?: {
  slug?: string | null;
  title?: string | null;
  promptRules?: string | null;
} | null): DesignTextConstraints {
  const rules = input?.promptRules ?? "";
  const textPolicy = extractLineValue(rules, "Text policy");
  const maxWords = deriveMaxWords(rules);
  const constraints = {
    maxWords,
    textRole: textPolicy ? firstSentence(textPolicy) : undefined,
    textPlacement: extractPlacement(textPolicy),
    typography: extractTypography(textPolicy),
    requiresGuestFace: designRequiresGuestFace(input),
    summary: designTextSummary({
      title: input?.title,
      maxWords,
      textPolicy,
      requiresGuestFace: designRequiresGuestFace(input)
    })
  };
  return constraints;
}

export function designRequiresGuestFace(input?: { slug?: string | null; promptRules?: string | null } | null) {
  const slug = input?.slug?.toLowerCase() ?? "";
  const rules = input?.promptRules?.toLowerCase() ?? "";
  return (
    ["podcast", "podcast-countdown", "brain-rot-podcast"].includes(slug) ||
    /two[- ]person|two people|two large|two podcast|two speaker|two speakers|two guests|host plus guest|speaker cutouts/u.test(rules)
  );
}

function deriveMaxWords(rules: string) {
  const lineValue = extractLineValue(rules, "Max text words");
  const direct = lineValue ? Number.parseInt(lineValue, 10) : undefined;
  if (direct && direct > 0) return direct;

  const match = rules.toLowerCase().match(/(?:max text words|max words|maximum|до|не больше|не более)\D{0,12}(\d{1,2})/u);
  const parsed = match?.[1] ? Number.parseInt(match[1], 10) : undefined;
  return parsed && parsed > 0 ? parsed : undefined;
}

function extractLineValue(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "imu"));
  return match?.[1]?.trim();
}

function extractPlacement(textPolicy?: string) {
  if (!textPolicy) return undefined;
  const placementHints = [
    "centered",
    "top",
    "bottom",
    "left",
    "right",
    "inside board",
    "inside card",
    "full width",
    "between faces"
  ];
  const lower = textPolicy.toLowerCase();
  return placementHints.filter((hint) => lower.includes(hint)).join(", ") || undefined;
}

function extractTypography(textPolicy?: string) {
  if (!textPolicy) return undefined;
  const typographyMarkers = ["typography:", "serif", "sans", "uppercase", "condensed", "bold", "italic", "yellow", "white"];
  const lower = textPolicy.toLowerCase();
  if (!typographyMarkers.some((marker) => lower.includes(marker))) return undefined;
  return textPolicy;
}

function firstSentence(value: string) {
  return value.split(/[.!?]\s/u)[0]?.trim() || value;
}

function designTextSummary(input: { title?: string | null; maxWords?: number; textPolicy?: string; requiresGuestFace: boolean }) {
  return [
    input.title ? `Design: ${input.title}.` : undefined,
    input.maxWords ? `Hook limit: ${input.maxWords} words maximum.` : undefined,
    input.textPolicy ? `Text system: ${input.textPolicy}.` : undefined,
    input.requiresGuestFace ? "This design expects two distinct people; require a separate guest face reference." : undefined
  ].filter(Boolean).join(" ");
}
