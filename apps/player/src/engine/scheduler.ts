import type { PlayerConfig, PlaylistConfig, ScheduleConfig } from '@signflow/types';

function isScheduleActive(schedule: ScheduleConfig, now: Date): boolean {
  if (!schedule.isActive) return false;

  const startDate = new Date(schedule.startDate);
  if (now < startDate) return false;

  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate);
    if (now > endDate) return false;
  }

  // Check day of week
  if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(now.getUTCDay())) {
    return false;
  }

  // Check time window
  if (schedule.startTime || schedule.endTime) {
    const hh = now.getUTCHours();
    const mm = now.getUTCMinutes();
    const currentMinutes = hh * 60 + mm;

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

export function resolveActivePlaylist(
  config: PlayerConfig,
  now: Date
): PlaylistConfig | null {
  const playlistMap = new Map(config.playlists.map((p) => [p.id, p]));

  // Find all active schedules and sort by priority descending
  const activeSchedules = config.schedules
    .filter((s) => isScheduleActive(s, now))
    .sort((a, b) => b.priority - a.priority);

  // Return playlist for the highest-priority active schedule
  for (const schedule of activeSchedules) {
    const playlist = playlistMap.get(schedule.playlistId);
    if (playlist) return playlist;
  }

  // Fallback to default playlist
  return config.playlists.find((p) => p.isDefault) ?? null;
}
