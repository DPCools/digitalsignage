-- Migration: add_alert_template_and_api_key
-- Applies to: all tenant schemas (tenant_<slug>)
-- Run via: pnpm db:migrate:tenant or manually with apply-tenant-migrations.ts
--
-- Changes:
--   1. Add TargetType enum
--   2. Create AlertTemplate table
--   3. Create ApiKey table
--   4. Add EmergencyAlert.templateId (loose reference, no FK)
--   5. Add EmergencyAlert.updatedAt
--   6. Add ApiKey.updatedAt

-- 1. TargetType enum
DO $$ BEGIN
  CREATE TYPE "TargetType" AS ENUM ('ALL', 'GROUPS', 'SCREENS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. AlertTemplate table
CREATE TABLE IF NOT EXISTS "AlertTemplate" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "message"           TEXT NOT NULL,
    "backgroundColor"   TEXT NOT NULL DEFAULT '#FF0000',
    "textColor"         TEXT NOT NULL DEFAULT '#FFFFFF',
    "targetType"        "TargetType" NOT NULL DEFAULT 'ALL',
    "targetGroupIds"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "targetScreenIds"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "autoExpireMinutes" INTEGER,
    "createdBy"         TEXT NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertTemplate_pkey" PRIMARY KEY ("id")
);

-- 3. ApiKey table
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "keyPrefix"  TEXT NOT NULL,
    "keyHash"    TEXT NOT NULL,
    "createdBy"  TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt"  TIMESTAMP(3),
    "revokedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- Unique indexes for ApiKey lookup (prefix for fast lookup, hash for verification)
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyPrefix_key" ON "ApiKey"("keyPrefix");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key"   ON "ApiKey"("keyHash");

-- 4. Add EmergencyAlert.templateId (nullable, no FK — intentional loose reference)
ALTER TABLE "EmergencyAlert"
  ADD COLUMN IF NOT EXISTS "templateId" TEXT;

-- 5. Add EmergencyAlert.updatedAt (backfill existing rows with createdAt value)
ALTER TABLE "EmergencyAlert"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "EmergencyAlert"
  SET "updatedAt" = "createdAt"
  WHERE "updatedAt" IS NULL;

ALTER TABLE "EmergencyAlert"
  ALTER COLUMN "updatedAt" SET NOT NULL;
