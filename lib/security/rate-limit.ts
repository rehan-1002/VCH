/**
 * Rate Limiter for Token Creation
 * Limit: 2 token creations per 15 minutes per IP.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const ipCreationMap = new Map<string, RateLimitRecord>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_WINDOW = 500; // Generous limit for high-traffic institutional testing

export function checkTokenCreationRateLimit(ip: string, isDemoMode = true): {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
} {
  // Always allow loopback / local dev IPs
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    return { allowed: true, remaining: 999, resetTimeMs: WINDOW_MS };
  }

  const now = Date.now();
  const maxAllowed = isDemoMode ? 500 : MAX_PER_WINDOW;

  let record = ipCreationMap.get(ip);
  if (!record) {
    record = { timestamps: [] };
    ipCreationMap.set(ip, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((t) => now - t < WINDOW_MS);

  if (record.timestamps.length >= maxAllowed) {
    const oldestTimestamp = record.timestamps[0];
    const resetTimeMs = WINDOW_MS - (now - oldestTimestamp);
    return {
      allowed: false,
      remaining: 0,
      resetTimeMs: Math.max(0, resetTimeMs),
    };
  }

  // Record this attempt
  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxAllowed - record.timestamps.length,
    resetTimeMs: WINDOW_MS,
  };
}
