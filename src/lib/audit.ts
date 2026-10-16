import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId: entityId ?? null, metadata } });
}
