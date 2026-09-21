"use client";

export type PlayerQualityPreference =
  | { mode: "auto" }
  | { mode: "height"; height: number };

const QUALITY_KEY = "pinflix.player.quality.v1";

export function readQualityPreference(): PlayerQualityPreference {
  if (typeof window === "undefined") return { mode: "auto" };

  try {
    const raw = window.localStorage.getItem(QUALITY_KEY);
    if (!raw) return { mode: "auto" };

    const parsed = JSON.parse(raw) as Partial<PlayerQualityPreference>;
    if (parsed.mode === "height" && typeof parsed.height === "number" && parsed.height > 0) {
      return { mode: "height", height: parsed.height };
    }
  } catch {
    // Ignore unavailable/corrupt storage.
  }

  return { mode: "auto" };
}

export function writeQualityPreference(preference: PlayerQualityPreference): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(QUALITY_KEY, JSON.stringify(preference));
  } catch {
    // Storage can be unavailable in private/restricted contexts.
  }
}
