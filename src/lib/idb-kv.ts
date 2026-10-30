/**
 * Sync-looking key/value storage backed by IndexedDB (far larger quota than localStorage), with
 * an in-memory mirror so reads never need to be awaited.
 */

const DB_NAME = "rt-cache";
const STORE_NAME = "kv";
const DB_VERSION = 1;

const memory = new Map<string, string>();
let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

async function hydrateMirror(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      memory.set(String(cursor.key), cursor.value as string);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/** Resolves once the in-memory mirror reflects what's in IndexedDB (never rejects). */
export const idbReady: Promise<void> = hydrateMirror().catch(() => {
  // IndexedDB unavailable (private browsing, disabled, old browser, test env): memory-only.
});

/** Sync read from the mirror; null before `idbReady` resolves or if the key was never set. */
export function getIdbItem(key: string): string | null {
  return memory.get(key) ?? null;
}

/** Sync write to the mirror; persisted to IndexedDB in the background. */
export function setIdbItem(key: string, value: string): void {
  memory.set(key, value);
  void getDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        }),
    )
    .catch(() => {});
}

export function removeIdbItem(key: string): void {
  memory.delete(key);
  void getDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        }),
    )
    .catch(() => {});
}

/**
 * Removes a migrated key from both the IndexedDB mirror and any leftover localStorage copy
 * (e.g. if migration hasn't run/finished yet). Use this for "wipe this cache" call sites instead
 * of `removeIdbItem` so a stale legacy entry can never resurface.
 */
export function removeMigratedItem(key: string): void {
  removeIdbItem(key);
  try {
    localStorage.removeItem(key);
    // eslint-disable-next-line no-empty
  } catch {}
}

/**
 * One-time cutover per key: if localStorage still holds data under `key`, imports it into
 * IndexedDB and deletes the localStorage copy (freeing real quota). No-op once migrated, and
 * safe to call on every boot.
 */
export async function migrateLegacyKeyToIdb(key: string): Promise<void> {
  await idbReady;
  if (memory.has(key)) return;
  let legacy: string | null;
  try {
    legacy = localStorage.getItem(key);
  } catch {
    return;
  }
  if (legacy === null) return;
  setIdbItem(key, legacy);
  try {
    localStorage.removeItem(key);
    // eslint-disable-next-line no-empty
  } catch {}
}
