import type { TenantPrismaClient } from '@signflow/db';

export async function writeAuditLog(
  db: TenantPrismaClient,
  entry: {
    action: string;
    actorId: string;
    actorName: string;
    targetId?: string;
    targetName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        ...entry,
        // Prisma Json fields require explicit cast from plain objects
        metadata: entry.metadata as object | undefined,
      },
    });
  } catch {
    // Audit log failure must never surface to the caller
  }
}
