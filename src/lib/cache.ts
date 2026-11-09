// A small in-memory cache for numbers many visitors share, so each server instance
// reads the database at most once per `ttlMs` per key. Calls that arrive while a
// read is in flight share it.

const entries = new Map<string, { at: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  entries.set(key, { at: Date.now(), value });
  // A failed read isn't kept, so the next call tries again
  value.catch(() => entries.delete(key));
  return value;
}
