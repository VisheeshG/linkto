/**
 * Fixed-window request counter kept in memory. It lives in one server
 * instance, so on a platform that runs several instances the effective limit
 * is per instance: enough to stop a runaway script or a casual flood, not a
 * substitute for a network-level firewall.
 */
export class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 20_000,
    private readonly now: () => number = Date.now
  ) {}

  /** Counts one request. `retryAfterSeconds` is set when it is over the limit. */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.now();
    let entry = this.windows.get(key);

    if (!entry || entry.resetAt <= now) {
      if (this.windows.size >= this.maxKeys) this.prune(now);
      entry = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, entry);
    }

    entry.count += 1;
    return {
      allowed: entry.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  private prune(now: number): void {
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key);
    }
    // Still full of live windows: drop the oldest ones.
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}
