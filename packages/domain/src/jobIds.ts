export function hookJobId(projectId: string) {
  return `hooks-${safeJobIdPart(projectId)}`;
}

export function generationJobId(generationId: string) {
  return `generation-${safeJobIdPart(generationId)}`;
}

export function faceCardJobId(faceAssetId: string) {
  return `face-card-${safeJobIdPart(faceAssetId)}`;
}

function safeJobIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
