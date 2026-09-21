import type { Channel, Stream } from "./types";

type RuntimeHealth = {
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  ewmaLatencyMs: number | null;
  updatedAt: number;
};

export type StreamHealthSnapshot = {
  state: "healthy" | "degraded" | "failing" | "unknown";
  score: number;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  latencyMs: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
};

export type ChannelHealthSummary = {
  state: "available" | "degraded" | "unverified" | "unavailable";
  sourceCount: number;
  healthySources: number;
  preferredQuality: string | null;
  preferredScore: number | null;
};

const runtimeHealth = new Map<string, RuntimeHealth>();
const OBSERVATION_TTL_MS = 30 * 60_000;
const MAX_TRACKED = 1_200;
const EWMA_ALPHA = 0.35;

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

function liveState(url: string): RuntimeHealth | null {
  const state = runtimeHealth.get(url);
  if (!state) return null;
  if (Date.now() - state.updatedAt > OBSERVATION_TTL_MS) {
    runtimeHealth.delete(url);
    return null;
  }
  return state;
}

function pruneRuntimeHealth() {
  if (runtimeHealth.size <= MAX_TRACKED) return;
  const entries = [...runtimeHealth.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (const [url] of entries.slice(0, runtimeHealth.size - MAX_TRACKED)) runtimeHealth.delete(url);
}

/**
 * Passive health monitoring inspired by mature IPTV managers such as Dispatcharr.
 * Pinflix records only upstream source performance. No viewer identifiers are stored.
 */
export function recordStreamResult(
  url: string,
  result: { ok: boolean; latencyMs?: number | null },
): void {
  const now = Date.now();
  const current = liveState(url) ?? {
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    ewmaLatencyMs: null,
    updatedAt: now,
  };

  const latency =
    typeof result.latencyMs === "number" && Number.isFinite(result.latencyMs)
      ? Math.max(0, Math.round(result.latencyMs))
      : null;

  const ewmaLatencyMs =
    latency === null
      ? current.ewmaLatencyMs
      : current.ewmaLatencyMs === null
        ? latency
        : Math.round(current.ewmaLatencyMs * (1 - EWMA_ALPHA) + latency * EWMA_ALPHA);

  runtimeHealth.set(url, {
    successes: current.successes + Number(result.ok),
    failures: current.failures + Number(!result.ok),
    consecutiveFailures: result.ok ? 0 : Math.min(8, current.consecutiveFailures + 1),
    lastSuccessAt: result.ok ? now : current.lastSuccessAt,
    lastFailureAt: result.ok ? current.lastFailureAt : now,
    ewmaLatencyMs,
    updatedAt: now,
  });

  pruneRuntimeHealth();
}

export function recordStreamFailure(url: string, latencyMs?: number | null): void {
  recordStreamResult(url, { ok: false, latencyMs });
}

export function recordStreamSuccess(url: string, latencyMs?: number | null): void {
  recordStreamResult(url, { ok: true, latencyMs });
}

function observedAdjustment(url: string): number {
  const state = liveState(url);
  if (!state) return 0;

  const total = state.successes + state.failures;
  const ratio = total > 0 ? state.successes / total : 0.5;
  let adjustment = Math.round((ratio - 0.5) * 26);

  adjustment -= Math.min(48, state.consecutiveFailures * 14);

  if (state.ewmaLatencyMs !== null) {
    if (state.ewmaLatencyMs <= 800) adjustment += 8;
    else if (state.ewmaLatencyMs <= 1_800) adjustment += 4;
    else if (state.ewmaLatencyMs >= 8_000) adjustment -= 14;
    else if (state.ewmaLatencyMs >= 4_000) adjustment -= 8;
  }

  return adjustment;
}

/**
 * Source priority score:
 * transport safety + restrictions + quality + observed reliability/latency.
 * The browser player still performs the final automatic failover.
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
  score += observedAdjustment(stream.url);

  return score;
}

export function compareStreamHealth(a: Stream, b: Stream): number {
  return streamHealthScore(b) - streamHealthScore(a);
}

export function getStreamHealthSnapshot(stream: Stream): StreamHealthSnapshot {
  const observed = liveState(stream.url);
  const score = streamHealthScore(stream);

  let state: StreamHealthSnapshot["state"] = "unknown";
  if (observed) {
    if (observed.consecutiveFailures >= 2 || score < 35) state = "failing";
    else if (observed.failures > 0 || score < 60) state = "degraded";
    else state = "healthy";
  }

  return {
    state,
    score,
    successes: observed?.successes ?? 0,
    failures: observed?.failures ?? 0,
    consecutiveFailures: observed?.consecutiveFailures ?? 0,
    latencyMs: observed?.ewmaLatencyMs ?? null,
    lastSuccessAt: observed?.lastSuccessAt ?? null,
    lastFailureAt: observed?.lastFailureAt ?? null,
  };
}

export function getChannelHealthSummary(channel: Channel): ChannelHealthSummary {
  const snapshots = channel.streams.map(getStreamHealthSnapshot);
  const verified = snapshots.filter((snapshot) => snapshot.state !== "unknown");
  const healthySources = snapshots.filter((snapshot) => snapshot.state === "healthy").length;

  let state: ChannelHealthSummary["state"] = "unverified";
  if (channel.streams.length === 0) {
    state = "unavailable";
  } else if (verified.length > 0) {
    state = healthySources > 0 ? "available" : "degraded";
  }

  return {
    state,
    sourceCount: channel.streams.length,
    healthySources,
    preferredQuality: channel.streams[0]?.quality ?? channel.quality,
    preferredScore: channel.streams[0] ? streamHealthScore(channel.streams[0]) : null,
  };
}
