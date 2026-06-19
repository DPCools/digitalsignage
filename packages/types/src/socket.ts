import type { EmergencyAlertConfig, PlayerConfig } from './player';

export interface ServerToClientEvents {
  'playlist:update': (config: PlayerConfig) => void;
  'alert:emergency': (alert: EmergencyAlertConfig) => void;
  'alert:clear': () => void;
  'screen:reload': () => void;
  'screen:screenshot': () => void;
  'config:update': (patch: Partial<PlayerConfig>) => void;
}

export interface ClientToServerEvents {
  'screen:join': (data: { screenId: string; orgSlug: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}
