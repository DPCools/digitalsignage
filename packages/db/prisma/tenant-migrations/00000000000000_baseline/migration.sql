-- Baseline: full tenant schema as it existed before this migration-based
-- system replaced `prisma db push` for tenant provisioning, PLUS anything
-- since added directly via CREATE TABLE (not ALTER) by a later incremental
-- migration in this directory is deliberately left OUT here — that
-- migration remains the sole author of its table/columns so its exact
-- intended constraints (e.g. NOT NULL DEFAULT on recipientListIds) aren't
-- silently downgraded by a plain `prisma migrate diff` reconstruction.
-- Idempotent (IF NOT EXISTS / duplicate_object guards throughout) so it's
-- safe against a schema that already has some of these objects from the
-- old db-push-based bootstrap. Must stay sorted first (00000000000000_) so
-- every other migration here can assume its tables already exist.
-- Regenerate the full picture with:
--   npx prisma migrate diff --from-empty --to-schema-datamodel ./prisma/tenant.prisma --script


-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GroupType" AS ENUM ('SITE', 'LOCATION', 'DEPARTMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Orientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ContentType" AS ENUM ('IMAGE', 'VIDEO', 'HTML_TEMPLATE', 'RSS_FEED', 'PDF', 'WEB_PAGE', 'CCTV_GRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TransitionType" AS ENUM ('FADE', 'SLIDE_LEFT', 'SLIDE_RIGHT', 'ZOOM', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecurrenceType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TargetType" AS ENUM ('ALL', 'GROUPS', 'SCREENS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AlertSeverity" AS ENUM ('EMERGENCY', 'WARNING', 'INFO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Screen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uniqueCode" TEXT NOT NULL,
    "groupId" TEXT,
    "orientation" "Orientation" NOT NULL DEFAULT 'LANDSCAPE',
    "resolution" TEXT,
    "tags" TEXT[],
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeat" TIMESTAMP(3),
    "lastSnapshot" TEXT,
    "currentPlaylistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScreenGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "description" TEXT,
    "defaultPlaylistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContentItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "duration" INTEGER,
    "templateId" TEXT,
    "metadata" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "css" TEXT,
    "variables" JSONB NOT NULL,
    "thumbnail" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Playlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "transition" "TransitionType" NOT NULL DEFAULT 'FADE',
    "zone" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Schedule" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "name" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'ONCE',
    "daysOfWeek" INTEGER[],
    "screenIds" TEXT[],
    "groupIds" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL DEFAULT '#FF0000',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "screenIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScreenHeartbeat" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playlistId" TEXT,
    "contentId" TEXT,

    CONSTRAINT "ScreenHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Impression" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "Impression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Screen_uniqueCode_key" ON "Screen"("uniqueCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Screen_lastHeartbeat_idx" ON "Screen"("lastHeartbeat" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Screen_currentPlaylistId_idx" ON "Screen"("currentPlaylistId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Screen_groupId_idx" ON "Screen"("groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_status_idx" ON "ContentItem"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_type_idx" ON "ContentItem"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentItem_createdAt_idx" ON "ContentItem"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlaylistItem_playlistId_position_key" ON "PlaylistItem"("playlistId", "position");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Schedule_playlistId_idx" ON "Schedule"("playlistId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Schedule_isActive_idx" ON "Schedule"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmergencyAlert_isActive_idx" ON "EmergencyAlert"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScreenHeartbeat_screenId_timestamp_idx" ON "ScreenHeartbeat"("screenId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Impression_playedAt_idx" ON "Impression"("playedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Impression_contentItemId_idx" ON "Impression"("contentItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Impression_screenId_idx" ON "Impression"("screenId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Screen" ADD CONSTRAINT "Screen_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ScreenGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Screen" ADD CONSTRAINT "Screen_currentPlaylistId_fkey" FOREIGN KEY ("currentPlaylistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ScreenGroup" ADD CONSTRAINT "ScreenGroup_defaultPlaylistId_fkey" FOREIGN KEY ("defaultPlaylistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ScreenHeartbeat" ADD CONSTRAINT "ScreenHeartbeat_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Impression" ADD CONSTRAINT "Impression_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Impression" ADD CONSTRAINT "Impression_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
