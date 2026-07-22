import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImpressionRecord } from '@signflow/types';

// ---------------------------------------------------------------------------
// In-memory mock for the `idb` module
// ---------------------------------------------------------------------------

// Each store is a Map<key, value>. Auto-increment stores track a counter.
type StoreData = Map<unknown, unknown>;

interface MockStore {
  data: StoreData;
  autoIncrement: boolean;
  counter: number;
  indexes: Map<string, string>; // indexName -> keyPath
}

interface MockDB {
  stores: Map<string, MockStore>;
}

function createMockDB(): MockDB {
  return { stores: new Map() };
}

// Build a transaction-like object around the live store maps.
function makeTxStore(store: MockStore) {
  let counter = store.counter;
  return {
    getAll: async () => Array.from(store.data.values()),
    clear: async () => { store.data.clear(); store.counter = 0; },
    get done() {
      return Promise.resolve();
    },
  };
}

function makeStoreProxy(store: MockStore) {
  return {
    get: async (key: unknown) => store.data.get(key),
    put: async (value: unknown, key?: unknown) => {
      if (key !== undefined) {
        store.data.set(key, value);
        return key;
      }
      // auto-increment
      store.counter += 1;
      store.data.set(store.counter, value);
      return store.counter;
    },
    add: async (value: unknown, key?: unknown) => {
      if (key !== undefined) {
        store.data.set(key, value);
        return key;
      }
      store.counter += 1;
      store.data.set(store.counter, value);
      return store.counter;
    },
    getAll: async () => Array.from(store.data.values()),
    clear: async () => { store.data.clear(); store.counter = 0; },
    createIndex: (name: string, keyPath: string) => {
      store.indexes.set(name, keyPath);
    },
  };
}

// The mock openDB factory — returns a fresh db-like object each call.
let currentMockDB: MockDB = createMockDB();

vi.mock('idb', () => ({
  openDB: vi.fn((_name: string, _version: number, { upgrade }: { upgrade: (db: unknown, oldVersion: number) => void }) => {
    // Run upgrade callback with a db-proxy that can createObjectStore. The mock
    // always simulates a brand-new database, so oldVersion is always 0 — same
    // as a real first-ever openDB call, which is the only case tested here.
    const upgradeProxy = {
      createObjectStore: (storeName: string, opts?: { autoIncrement?: boolean }) => {
        const store: MockStore = {
          data: new Map(),
          autoIncrement: opts?.autoIncrement ?? false,
          counter: 0,
          indexes: new Map(),
        };
        currentMockDB.stores.set(storeName, store);
        return makeStoreProxy(store);
      },
      deleteObjectStore: (storeName: string) => {
        currentMockDB.stores.delete(storeName);
      },
      objectStoreNames: {
        contains: (storeName: string) => currentMockDB.stores.has(storeName),
      },
    };
    upgrade(upgradeProxy, 0);

    // Return a db-proxy
    const dbProxy = {
      get: async (storeName: string, key: unknown) => {
        const store = currentMockDB.stores.get(storeName);
        return store?.data.get(key);
      },
      put: async (storeName: string, value: unknown, key?: unknown) => {
        const store = currentMockDB.stores.get(storeName);
        if (!store) throw new Error(`Store ${storeName} not found`);
        return makeStoreProxy(store).put(value, key);
      },
      add: async (storeName: string, value: unknown) => {
        const store = currentMockDB.stores.get(storeName);
        if (!store) throw new Error(`Store ${storeName} not found`);
        return makeStoreProxy(store).add(value);
      },
      transaction: (storeName: string, _mode: string) => {
        const store = currentMockDB.stores.get(storeName);
        if (!store) throw new Error(`Store ${storeName} not found`);
        const txStore = makeTxStore(store);
        return { store: txStore, done: Promise.resolve() };
      },
    };

    return Promise.resolve(dbProxy);
  }),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER setting up the mock
// ---------------------------------------------------------------------------
// We need to reset the module's cached `_db` between tests so each test
// gets a clean database. We do this by resetting `currentMockDB` and
// re-importing the module each time via dynamic import with cache-busting.
// Vitest's module isolation makes this straightforward with `vi.resetModules`.

beforeEach(() => {
  vi.resetModules();
  currentMockDB = createMockDB();
});

async function getDbModule() {
  return import('../lib/db');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('db – getConfig / setConfig', () => {
  it('returns undefined when nothing is stored', async () => {
    const { getConfig } = await getDbModule();
    const result = await getConfig();
    expect(result).toBeUndefined();
  });

  it('round-trips a config value', async () => {
    const { getConfig, setConfig } = await getDbModule();
    const cfg = { screenId: 'scr-1', orgSlug: 'acme', token: 'tok-abc' };
    await setConfig(cfg);
    const result = await getConfig();
    expect(result).toEqual(cfg);
  });

  it('overwrites an existing config value', async () => {
    const { getConfig, setConfig } = await getDbModule();
    await setConfig({ screenId: 'scr-1', orgSlug: 'acme', token: 'old-tok' });
    await setConfig({ screenId: 'scr-2', orgSlug: 'beta', token: 'new-tok' });
    const result = await getConfig();
    expect(result).toEqual({ screenId: 'scr-2', orgSlug: 'beta', token: 'new-tok' });
  });
});

describe('db – queueImpression / flushImpressions', () => {
  it('returns empty array when store is empty', async () => {
    const { flushImpressions } = await getDbModule();
    const result = await flushImpressions();
    expect(result).toEqual([]);
  });

  it('returns queued records and clears the store', async () => {
    const { queueImpression, flushImpressions } = await getDbModule();

    const impression1: ImpressionRecord = {
      contentItemId: 'cnt-1',
      screenId: 'scr-1',
      playedAt: '2026-06-15T10:00:00.000Z',
      durationMs: 5000,
    };
    const impression2: ImpressionRecord = {
      contentItemId: 'cnt-2',
      screenId: 'scr-1',
      playedAt: '2026-06-15T10:00:05.000Z',
      durationMs: 8000,
    };

    await queueImpression(impression1);
    await queueImpression(impression2);

    const flushed = await flushImpressions();
    expect(flushed).toHaveLength(2);
    expect(flushed).toContainEqual(impression1);
    expect(flushed).toContainEqual(impression2);
  });

  it('clears the store after flush so a second flush returns empty', async () => {
    const { queueImpression, flushImpressions } = await getDbModule();

    const impression: ImpressionRecord = {
      contentItemId: 'cnt-1',
      screenId: 'scr-1',
      playedAt: '2026-06-15T11:00:00.000Z',
      durationMs: 3000,
    };

    await queueImpression(impression);
    await flushImpressions();

    const second = await flushImpressions();
    expect(second).toEqual([]);
  });
});
