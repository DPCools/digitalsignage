ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ContentItem_expiresAt_idx" ON "ContentItem"("expiresAt");
