import { openDB, type IDBPDatabase } from 'idb';
import type { PlayerConfig, ImpressionRecord } from '@signflow/types';

export interface SignFlowDB {
  config: { key: 'main'; value: { screenId: string; orgSlug: string; token: string } };
  playlist: { key: 'main'; value: PlayerConfig };
  impressions: { key: number; value: ImpressionRecord; indexes: { byTime: string } };
}

let _db: IDBPDatabase<SignFlowDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<SignFlowDB>> {
  if (_db) return _db;
  _db = await openDB<SignFlowDB>('signflow-player', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('config');
        db.createObjectStore('playlist');
        const impressions = db.createObjectStore('impressions', { autoIncrement: true });
        impressions.createIndex('byTime', 'playedAt');
      }
      // v2: asset caching moved to Cache Storage via the service worker
      // (apps/player/src/lib/assetCache.ts) — the old per-session blob-URL
      // store was evicted on every reload by design, which was the bug.
      if (oldVersion < 2 && db.objectStoreNames.contains('assets')) {
        db.deleteObjectStore('assets');
      }
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
