import type { PlayerConfig, ImpressionRecord } from '@signflow/types';
import { flushImpressions, getConfig } from './db';
import { reportHttpSuccess, reportHttpFailure } from './connectivity';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function authHeaders(): Promise<Record<string, string>> {
  const cfg = await getConfig();
  if (!cfg?.token) return { 'Content-Type': 'application/json' };
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` };
}

export async function fetchPlayerConfig(
  screenId: string,
  orgSlug: string
): Promise<PlayerConfig> {
  const headers = await authHeaders();
  try {
    const res = await fetch(
      `${BASE}/api/player/config?screenId=${encodeURIComponent(screenId)}&orgSlug=${encodeURIComponent(orgSlug)}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
    reportHttpSuccess();
    return await res.json();
  } catch (err) {
    reportHttpFailure();
    throw err;
  }
}

export async function sendHeartbeat(
  screenId: string,
  orgSlug: string,
  playlistId?: string,
  contentId?: string
) {
  const headers = await authHeaders();
  return fetch(`${BASE}/api/player/heartbeat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ screenId, orgSlug, playlistId, contentId }),
  }).then((res) => {
    if (res.ok) reportHttpSuccess();
    else reportHttpFailure();
    return res;
  }).catch(() => {
    reportHttpFailure();
    return null;
  });
}

export async function sendImpressions(orgSlug: string, screenId: string) {
  const impressions = await flushImpressions();
  if (!impressions.length) return;
  const headers = await authHeaders();
  return fetch(`${BASE}/api/player/impressions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orgSlug, screenId, impressions }),
  }).catch(() => null);
}

export async function sendSnapshot(
  orgSlug: string,
  screenId: string,
  imageBase64: string
) {
  const headers = await authHeaders();
  return fetch(`${BASE}/api/player/snapshot`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orgSlug, screenId, imageBase64 }),
  }).catch(() => null);
}

export async function checkSnapshotTrigger(
  screenId: string,
  orgSlug: string
): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(
    `${BASE}/api/player/snapshot-trigger?screenId=${encodeURIComponent(screenId)}&orgSlug=${encodeURIComponent(orgSlug)}`,
    { headers }
  ).catch(() => null);
  if (!res?.ok) return false;
  const data = await res.json().catch(() => ({}));
  return data.pending === true;
}

export async function reportError(
  orgSlug: string,
  screenId: string,
  zone: string,
  message: string,
  stack?: string
) {
  const headers = await authHeaders();
  return fetch(`${BASE}/api/player/error`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orgSlug, screenId, zone, message, stack }),
  }).catch(() => null);
}
