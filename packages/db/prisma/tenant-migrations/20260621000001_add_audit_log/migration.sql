CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"         TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "actorId"    TEXT NOT NULL,
    "actorName"  TEXT NOT NULL,
    "targetId"   TEXT,
    "targetName" TEXT,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);
