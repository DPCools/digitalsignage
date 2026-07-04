-- Migration: add_audio_bridge
-- Applies to: all tenant schemas (tenant_<slug>)
-- Run via: pnpm db:migrate:tenant or manually with apply-tenant-migrations.ts
--
-- Changes:
--   1. Create AudioBridge table (Axis Audio Bridge devices, attached to a ScreenGroup/site)

CREATE TABLE IF NOT EXISTS "AudioBridge" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "groupId"   TEXT NOT NULL,
    "host"      TEXT NOT NULL,
    "port"      INTEGER NOT NULL DEFAULT 80,
    "username"  TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioBridge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AudioBridge_groupId_idx" ON "AudioBridge"("groupId");

DO $$ BEGIN
  ALTER TABLE "AudioBridge"
    ADD CONSTRAINT "AudioBridge_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ScreenGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
