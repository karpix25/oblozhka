import type { DbClient } from "./client.js";

export async function createAuditLog(
  db: DbClient,
  input: { actor: string; action: string; target: string; metadata?: object }
) {
  return db.auditLog.create({ data: input });
}

export async function listAuditLogs(db: DbClient) {
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });
}
