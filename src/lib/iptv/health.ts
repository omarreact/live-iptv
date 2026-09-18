import type { Stream } from "./types";

type RuntimeHealth = { failures: number; lastFailureAt: number };
const runtimeHealth = new Map<string, RuntimeHealth>();
const FAILURE_TTL_MS = 10 * 60_000;
const MAX_TRACKED = 800;

function qualityPoints(quality: string | null | undefined): number {
  if (!quality) return 0;
  const q = quality.toLowerCase();
  if (/4k|uhd|2160/.test(q)) return 16;
  if (/1440|2k/.test(q)) return 13;
  if (/1080|fhd|full\s*hd/.test(q)) return 10;
  if (/720|\bhd\b/.test(q)) return 7;
  if (/480|\bsd\b/.test(q)) return 3;
  return 0;
}

function runtimePenalty(url: string): number {
  const state = runtimeHealth.get(url);
  if (!state) return 0;
  const age = Date.now() - state.lastFailureAt;
  if (age > FAILURE_TTL_MS) {
    runtimeHealth.delete(url);
    return 0;
  }
  const freshness = 1 - age / FAILURE_TTL_MS;
  return Math.round(Math.min(36, state.failures * 12) * freshness);
}

function pruneRuntimeHealth() {
  if (runtimeHealth.size <= MAX_TRACKED) return;
  const entries = [...runtimeHealth.entries()].sort(
    (a, b) => a[1].lastFailureAt - b[1].lastFailureAt,
  );
  for (const [url] of entries.slice(0, runtimeHealth.size - MAX_TRACKED)) runtimeHealth.delete(url);
}

/**
 * Records short-lived upstream health hints on a warm server instance.
 * It is intentionally ephemeral; it is not analytics and stores no viewer data.
 */
export function recordStreamFailure(url: string): void {
  const current = runtimeHealth.get(url);
  runtimeHealth.set(url, {
    failures: Math.min(3, (current?.failures ?? 0) + 1),
    lastFailureAt: Date.now(),
  });
  pruneRuntimeHealth();
}

export function recordStreamSuccess(url: string): void {
  runtimeHealth.delete(url);
}

/**
 * Health-aware source score used before playback starts.
 * Static transport safety + recent upstream failures determine preference;
 * the player still performs the final automatic failover at runtime.
 */
export function streamHealthScore(stream: Stream): number {
  let score = 50;

  if (stream.geoBlocked) score -= 40;
  if (stream.not247) score -= 12;

  try {
    const url = new URL(stream.url);
    const rawIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname);
    if (url.protocol === "https:") score += 24;
    else if (url.protocol === "http:") score -= 4;
    else score -= 30;
    if (!rawIp) score += 8;
    else score -= 12;
  } catch {
    score -= 50;
  }

  if (stream.userAgent) score -= 4;
  if (stream.referrer) score -= 4;
  score += qualityPoints(stream.quality);
  score -= runtimePenalty(stream.url);
  return score;
}

export function compareStreamHealth(a: Stream, b: Stream): number {
  return streamHealthScore(b) - streamHealthScore(a);
}
