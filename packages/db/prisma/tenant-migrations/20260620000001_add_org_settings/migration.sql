CREATE TABLE IF NOT EXISTS "OrgSetting" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "OrgSetting_pkey" PRIMARY KEY ("key")
);
