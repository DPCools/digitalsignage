import { openDB, type IDBPDatabase } from 'idb';
import type { PlayerConfig, ImpressionRecord } from '@signflow/types';

// New random value every page load — used to detect stale blob URLs from previous sessions.
// crypto.randomUUID is unavailable on older TV/Pi browsers so fall back to Math.random.
const SESSION_ID: string =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface SignFlowDB {
  config: { key: 'main'; value: { screenId: string; orgSlug: string; token: string } };
  playlist: { key: 'main'; value: PlayerConfig };
  impressions: { key: number; value: ImpressionRecord; indexes: { byTime: string } };
  assets: { key: string; value: { url: string; blobUrl: string; cachedAt: number; sessionId?: string } };
}

let _db: IDBPDatabase<SignFlowDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<SignFlowDB>> {
  if (_db) return _db;
  _db = await openDB<SignFlowDB>('signflow-player', 1, {
    upgrade(db) {
      db.createObjectStore('config');
      db.createObjectStore('playlist');
      const impressions = db.createObjectStore('impressions', { autoIncrement: true });
      impressions.createIndex('byTime', 'playedAt');
      db.createObjectStore('assets');
    },
  });
  return _db;
}

export async function getConfig() {
  const db = await getDB();
  return db.get('config', 'main');
}

export async function setConfig(value: SignFlowDB['config']['value']) {
  const db = await getDB();
  return db.put('config', value, 'main');
}

export async function getPlayerConfig(): Promise<PlayerConfig | undefined> {
  const db = await getDB();
  return db.get('playlist', 'main');
}

export async function setPlayerConfig(config: PlayerConfig) {
  const db = await getDB();
  return db.put('playlist', config, 'main');
}

export async function queueImpression(impression: ImpressionRecord) {
  const db = await getDB();
  return db.add('impressions', impression);
}

export async function flushImpressions(): Promise<ImpressionRecord[]> {
  const db = await getDB();
  const tx = db.transaction('impressions', 'readwrite');
  const all = await tx.store.getAll();
  await tx.store.clear();
  await tx.done;
  return all;
}

export async function getCachedAsset(url: string): Promise<string | null> {
  const db = await getDB();
  const entry = await db.get('assets', url);
  if (!entry) return null;
  // Blob URLs are session-local — evict any entry from a previous session
  if (entry.blobUrl.startsWith('blob:') && entry.sessionId !== SESSION_ID) {
    await db.delete('assets', url);
    return null;
  }
  return entry.blobUrl;
}

export async function cacheAsset(url: string, blobUrl: string) {
  const db = await getDB();
  return db.put('assets', { url, blobUrl, cachedAt: Date.now(), sessionId: SESSION_ID }, url);
}
