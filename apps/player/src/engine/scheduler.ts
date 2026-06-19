import type { PlayerConfig, PlaylistConfig, ScheduleConfig } from '@signflow/types';

function isScheduleActive(schedule: ScheduleConfig, now: Date): boolean {
  if (!schedule.isActive) return false;

  const startDate = new Date(schedule.startDate);
  if (now < startDate) return false;

  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate);
    if (now > endDate) return false;
  }

  if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(now.getUTCDay())) {
    return false;
  }

  if (schedule.startTime || schedule.endTime) {
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (schedule.startTime) {
      const [sh, sm] = schedule.startTime.split(':').map(Number);
      if (currentMinutes < sh * 60 + sm) return false;
    }
    if (schedule.endTime) {
      const [eh, em] = schedule.endTime.split(':').map(Number);
      if (currentMinutes >= eh * 60 + em) return false;
    }
  }

  return true;
}

function scheduleTargetsScreen(schedule: ScheduleConfig, screenId: string, groupId: string | null): boolean {
  // No targeting = broadcast to all screens
  if (schedule.screenIds.length === 0 && schedule.groupIds.length === 0) return true;
  if (schedule.screenIds.includes(screenId)) return true;
  if (groupId && schedule.groupIds.includes(groupId)) return true;
  return false;
}

export function resolveActivePlaylist(
  config: PlayerConfig,
  now: Date
): PlaylistConfig | null {
  const playlistMap = new Map(config.playlists.map((p) => [p.id, p]));

  // Find active schedules targeting this screen/group, sorted by priority descending
  const activeSchedules = config.schedules
    .filter((s) => isScheduleActive(s, now) && scheduleTargetsScreen(s, config.screenId, config.groupId))
    .sort((a, b) => b.priority - a.priority);

  for (const schedule of activeSchedules) {
    const playlist = playlistMap.get(schedule.playlistId);
    if (playlist) return playlist;
  }

  // Fallback chain: group default → global default
  if (config.groupDefaultPlaylistId) {
    const groupDefault = playlistMap.get(config.groupDefaultPlaylistId);
    if (groupDefault) return groupDefault;
  }

  return config.playlists.find((p) => p.isDefault) ?? null;
}
