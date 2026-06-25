// Small in-process LRU+TTL cache for the slow AI endpoints (describe-area, ideal-business).
// Same area → same answer, so re-opening a location returns instantly instead of paying the
// 3–5s LLM round-trip again. Resets on server restart (acceptable). Isolated/no behavior change.
type Entry = { ts: number; data: unknown };

const TTL_MS = 1000 * 60 * 60 * 24; // 24h
const MAX_ENTRIES = 5000;
const store = new Map<string, Entry>();

export function aiCacheGet<T = unknown>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TTL_MS) {
    store.delete(key);
    return null;
  }
  // refresh LRU position
  store.delete(key);
  store.set(key, e);
  return e.data as T;
}

export function aiCacheSet(key: string, data: unknown): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { ts: Date.now(), data });
}
