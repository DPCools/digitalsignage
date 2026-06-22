-- Impression queries: count by date range, groupBy content, filter by screen
CREATE INDEX IF NOT EXISTS "Impression_playedAt_idx"      ON "Impression"("playedAt" DESC);
CREATE INDEX IF NOT EXISTS "Impression_contentItemId_idx" ON "Impression"("contentItemId");
CREATE INDEX IF NOT EXISTS "Impression_screenId_idx"      ON "Impression"("screenId");

-- ContentItem queries: filter by status (approval workflow), type, sort by date
CREATE INDEX IF NOT EXISTS "ContentItem_status_idx"    ON "ContentItem"("status");
CREATE INDEX IF NOT EXISTS "ContentItem_type_idx"      ON "ContentItem"("type");
CREATE INDEX IF NOT EXISTS "ContentItem_createdAt_idx" ON "ContentItem"("createdAt" DESC);

-- EmergencyAlert: dashboard counts active alerts
CREATE INDEX IF NOT EXISTS "EmergencyAlert_isActive_idx" ON "EmergencyAlert"("isActive");

-- Screen: dashboard queries last heartbeat; FK lookups
CREATE INDEX IF NOT EXISTS "Screen_lastHeartbeat_idx"     ON "Screen"("lastHeartbeat" DESC);
CREATE INDEX IF NOT EXISTS "Screen_currentPlaylistId_idx" ON "Screen"("currentPlaylistId");
CREATE INDEX IF NOT EXISTS "Screen_groupId_idx"           ON "Screen"("groupId");

-- ScreenHeartbeat: FK + recent-heartbeats-per-screen queries
CREATE INDEX IF NOT EXISTS "ScreenHeartbeat_screenId_timestamp_idx"
  ON "ScreenHeartbeat"("screenId", "timestamp" DESC);

-- Schedule: FK + isActive filter
CREATE INDEX IF NOT EXISTS "Schedule_playlistId_idx" ON "Schedule"("playlistId");
CREATE INDEX IF NOT EXISTS "Schedule_isActive_idx"   ON "Schedule"("isActive");
