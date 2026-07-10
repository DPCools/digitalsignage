ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "authToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Screen_authToken_key" ON "Screen"("authToken");
