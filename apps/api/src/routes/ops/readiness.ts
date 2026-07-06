import { prisma } from "@covers/db";
import { assertQueuesReady } from "./queueStatus.js";
import { pingRedis } from "./redis.js";

type ComponentName = "database" | "redis" | "queues";

export type ReadinessComponent = {
  name: ComponentName;
  ok: boolean;
  latencyMs: number;
  error?: string;
};

export type ReadinessReport = {
  ok: boolean;
  components: ReadinessComponent[];
};

export async function collectReadiness(): Promise<ReadinessReport> {
  const components = await Promise.all([
    checkComponent("database", checkDatabase),
    checkComponent("redis", pingRedis),
    checkComponent("queues", assertQueuesReady)
  ]);
  return {
    ok: components.every((component) => component.ok),
    components
  };
}

async function checkDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

async function checkComponent(name: ComponentName, check: () => Promise<void>): Promise<ReadinessComponent> {
  const startedAt = performance.now();
  try {
    await check();
    return { name, ok: true, latencyMs: elapsedMs(startedAt) };
  } catch (error) {
    return {
      name,
      ok: false,
      latencyMs: elapsedMs(startedAt),
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
