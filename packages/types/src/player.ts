export type Zone = 'main' | 'ticker' | 'clock' | 'weather';

export type ContentType = 'IMAGE' | 'VIDEO' | 'HTML_TEMPLATE' | 'RSS_FEED' | 'PDF' | 'WEB_PAGE' | 'CCTV_GRID';
export type TransitionType = 'FADE' | 'SLIDE_LEFT' | 'SLIDE_RIGHT' | 'ZOOM' | 'NONE';
export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type AlertSeverity = 'INFO' | 'WARNING' | 'EMERGENCY';

export interface PlaylistItemConfig {
  id: string;
  contentItemId: string;
  type: ContentType;
  url: string;
  duration: number;       // seconds
  transition: TransitionType;
  zone: Zone;
  metadata?: Record<string, unknown>;
}

export interface PlaylistConfig {
  id: string;
  name: string;
  isDefault: boolean;
  items: PlaylistItemConfig[];
}

export interface ScheduleConfig {
  id: string;
  playlistId: string;
  startDate: string;      // ISO date string
  endDate?: string;
  startTime?: string;     // "HH:MM"
  endTime?: string;       // "HH:MM"
  recurrence: RecurrenceType;
  daysOfWeek: number[];   // 0 = Sunday, 6 = Saturday
  screenIds: string[];
  groupIds: string[];
  priority: number;
  isActive: boolean;
}

export interface EmergencyAlertConfig {
  id: string;
  title: string;
  message: string;
  backgroundColor: string;
  textColor: string;
  screenIds: string[];    // empty = all screens
  isActive: boolean;
  expiresAt?: string;
  severity?: AlertSeverity;
}

export interface PlayerConfig {
  screenId: string;
  orgSlug: string;
  groupId: string | null;
  groupDefaultPlaylistId: string | null;
  playlists: PlaylistConfig[];
  schedules: ScheduleConfig[];
  activeAlert: EmergencyAlertConfig | null;
  weatherApiKey?: string;
  weatherLocation?: string;
  timezone: string;
  locale: string;
}

export interface ResolvedZoneQueue {
  zone: Zone;
  items: PlaylistItemConfig[];
  currentIndex: number;
}
