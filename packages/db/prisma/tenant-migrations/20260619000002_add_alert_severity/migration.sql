-- Add AlertSeverity enum and severity field to EmergencyAlert and AlertTemplate
DO $$ BEGIN
  CREATE TYPE "AlertSeverity" AS ENUM ('EMERGENCY', 'WARNING', 'INFO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "EmergencyAlert"
  ADD COLUMN IF NOT EXISTS "severity" "AlertSeverity" NOT NULL DEFAULT 'EMERGENCY';

ALTER TABLE "AlertTemplate"
  ADD COLUMN IF NOT EXISTS "severity" "AlertSeverity" NOT NULL DEFAULT 'EMERGENCY';
