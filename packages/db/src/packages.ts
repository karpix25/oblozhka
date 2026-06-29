import type { CreditPackageInput } from "@covers/domain";
import type { DbClient } from "./client.js";

export async function listActivePackages(db: DbClient) {
  return db.creditPackage.findMany({
    where: { isActive: true },
    orderBy: { starsPrice: "asc" }
  });
}

export async function listPackages(db: DbClient) {
  return db.creditPackage.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function createPackage(db: DbClient, input: CreditPackageInput) {
  return db.creditPackage.create({
    data: {
      title: input.title,
      description: input.description,
      starsPrice: input.starsPrice,
      credits: input.credits,
      isActive: input.isActive ?? true
    }
  });
}

export async function updatePackage(db: DbClient, id: string, input: Partial<CreditPackageInput>) {
  return db.creditPackage.update({
    where: { id },
    data: input
  });
}
