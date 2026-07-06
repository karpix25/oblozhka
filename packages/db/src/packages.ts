import { PAID_PLAN_ORDER, getPlanConfig, type CreditPackageInput } from "@covers/domain";
import type { DbClient } from "./client.js";

export async function listActivePackages(db: DbClient) {
  return db.creditPackage.findMany({
    where: { isActive: true },
    orderBy: { priceRub: "asc" }
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
      slug: input.slug,
      plan: input.plan,
      title: input.title,
      description: input.description,
      priceRub: input.priceRub,
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

export async function seedDefaultTariffPackages(db: DbClient) {
  for (const plan of PAID_PLAN_ORDER) {
    const config = getPlanConfig(plan);
    const slug = plan.toLowerCase();
    const envPrice = process.env[`${plan}_PRICE_RUB`];
    await db.creditPackage.upsert({
      where: { slug },
      create: {
        slug,
        plan,
        title: config.title,
        description: config.description,
        priceRub: envPrice ? Number(envPrice) : config.defaultPriceRub,
        credits: config.monthlyCredits ?? 0,
        isActive: true
      },
      update: {
        plan,
        title: config.title,
        description: config.description,
        credits: config.monthlyCredits ?? 0
      }
    });
  }
}
