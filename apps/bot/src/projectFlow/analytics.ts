import { prisma, recordProductEvent, type ProductEventName, type RecordProductEventInput } from "@covers/db";

export function trackProductEvent(
  name: ProductEventName,
  input: Omit<RecordProductEventInput, "name" | "createdAt"> = {}
) {
  void recordProductEvent(prisma, { name, ...input }).catch((error) => {
    console.warn("Product event was not recorded.", { name, error });
  });
}
