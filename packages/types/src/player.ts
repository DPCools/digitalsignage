import type { CellMode } from './layout-presets';

// Was a hardcoded 4-value union; now any cell id from a GridPreset, or a legacy zone id.
export type Zone = string;

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
  layoutPreset?: string | null;            // preset id, e.g. "2x2"; null/undefined = legacy 4-zone layout
  cellModes?: Record<string, CellMode>;    // cellId -> FIXED/DYNAMIC, meaningful only when layoutPreset is set
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
  soundUrl?: string;
  soundRepeat?: number;
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
  playerStreamToken?: string;  // short-lived token for CCTV stream proxy URLs (<img src>)
}

export interface ResolvedZoneQueue {
  zone: Zone;
  items: PlaylistItemConfig[];
  currentIndex: number;
  isFixed?: boolean;
}
