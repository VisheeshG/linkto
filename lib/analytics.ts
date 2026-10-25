// Request helpers for click tracking.

const LOOPBACK_IPS = new Set(["::1", "127.0.0.1", "localhost"]);

export function isLoopbackIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const normalized = ip.trim().toLowerCase();
  return (
    LOOPBACK_IPS.has(normalized) ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("127.")
  );
}

export function getClientIpFromRequest(request: Request): string | null {
  // Platform-set headers first: they cannot be spoofed by the client.
  const headerCandidates = [
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0],
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
    request.headers.get("true-client-ip"),
  ];

  for (const value of headerCandidates) {
    const ip = value?.trim();
    if (ip) return ip;
  }

  return null;
}
