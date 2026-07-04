CREATE TABLE IF NOT EXISTS "AlertSound" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertSound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AlertSound_key_key" ON "AlertSound"("key");

ALTER TABLE "EmergencyAlert" ADD COLUMN IF NOT EXISTS "soundUrl" TEXT;
ALTER TABLE "AlertTemplate"  ADD COLUMN IF NOT EXISTS "soundUrl" TEXT;
