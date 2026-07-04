-- Migration: add_email_notifications
-- Applies to: all tenant schemas (tenant_<slug>)
-- Run via: pnpm db:migrate:tenant or manually with apply-tenant-migrations.ts
--
-- Changes:
--   1. Create RecipientList table (named email distribution lists)
--   2. Create EmailTemplate table (one editable template per notification event)
--   3. Add EmergencyAlert.recipientListIds (lists emailed when an alert triggers)

CREATE TABLE IF NOT EXISTS "RecipientList" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "emails"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipientList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailTemplate" (
    "id"               TEXT NOT NULL,
    "event"            TEXT NOT NULL,
    "enabled"          BOOLEAN NOT NULL DEFAULT true,
    "subject"          TEXT NOT NULL,
    "bodyHtml"         TEXT NOT NULL,
    "recipientListIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_event_key" ON "EmailTemplate"("event");

ALTER TABLE "EmergencyAlert"
    ADD COLUMN IF NOT EXISTS "recipientListIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "AlertTemplate"
    ADD COLUMN IF NOT EXISTS "recipientListIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
