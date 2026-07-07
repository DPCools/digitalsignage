ALTER TABLE "Screen" ADD COLUMN "authToken" TEXT;
CREATE UNIQUE INDEX "Screen_authToken_key" ON "Screen"("authToken");
