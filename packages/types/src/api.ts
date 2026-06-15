export interface HeartbeatRequest {
  screenId: string;
  orgSlug: string;
  playlistId?: string;
  contentId?: string;
}

export interface HeartbeatResponse {
  ok: boolean;
}

export interface PairRequest {
  code: string;
}

export interface PairResponse {
  screenId: string;
  token: string;
  orgSlug: string;
}

export interface ImpressionRecord {
  contentItemId: string;
  screenId: string;
  playedAt: string;     // ISO string
  durationMs: number;
}

export interface ImpressionsRequest {
  orgSlug: string;
  screenId: string;
  impressions: ImpressionRecord[];
}

export interface SnapshotRequest {
  orgSlug: string;
  screenId: string;
  imageBase64: string;  // PNG, base64 encoded
}

export interface PlayerErrorRequest {
  orgSlug: string;
  screenId: string;
  zone: string;
  message: string;
  stack?: string;
}
