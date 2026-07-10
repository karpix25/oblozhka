import { ObjectStorage } from "@covers/storage";
import { prepareReferenceImageUrls } from "./referenceImages.js";

type ReferenceRole = "primary" | "guest" | "style";

export type PreparedGenerationReferences = Partial<Record<ReferenceRole, string>>;

export async function prepareGenerationReferences(input: {
  generationId: string;
  primaryUrl?: string;
  guestUrl?: string;
  styleUrl?: string;
  storage: ObjectStorage;
  signal?: AbortSignal;
}): Promise<PreparedGenerationReferences> {
  const entries = [
    ["primary", input.primaryUrl],
    ["guest", input.guestUrl],
    ["style", input.styleUrl]
  ].filter((entry): entry is [ReferenceRole, string] => Boolean(entry[1]));

  const preparedUrls = await prepareReferenceImageUrls({
    generationId: input.generationId,
    urls: entries.map(([, url]) => url),
    storage: input.storage,
    signal: input.signal
  });

  return Object.fromEntries(entries.map(([role], index) => [role, preparedUrls[index]]));
}
