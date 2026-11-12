/**
 * Small in-memory cache with per-entry expiry and a size cap (oldest entry is
 * evicted first). It lives in one server instance, so it only ever saves
 * database round trips; entries are never relied on for correctness beyond
 * their TTL.
 */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
