"use client";

export type PlayerQualityPreference =
  | { mode: "auto" }
  | { mode: "height"; height: number };

export type PlayerAudioPreference = {
  volume: number;
  muted: boolean;
};

const QUALITY_KEY = "pinflix.player.quality.v1";
const AUDIO_KEY = "pinflix.player.audio.v1";
const SUBTITLE_KEY = "pinflix.player.subtitle.v1";

export function readQualityPreference(): PlayerQualityPreference {
  if (typeof window === "undefined") return { mode: "auto" };

  try {
    const raw = window.localStorage.getItem(QUALITY_KEY);
    if (!raw) return { mode: "auto" };

    const parsed = JSON.parse(raw) as Partial<PlayerQualityPreference>;
    if (
      parsed.mode === "height" &&
      typeof parsed.height === "number" &&
      parsed.height > 0
    ) {
      return { mode: "height", height: parsed.height };
    }
  } catch {
    // Ignore unavailable/corrupt storage.
  }

  return { mode: "auto" };
}

export function writeQualityPreference(
  preference: PlayerQualityPreference,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(QUALITY_KEY, JSON.stringify(preference));
  } catch {
    // Storage can be unavailable in private/restricted contexts.
  }
}

export function readAudioPreference(): PlayerAudioPreference {
  if (typeof window === "undefined") return { volume: 1, muted: false };

  try {
    const raw = window.localStorage.getItem(AUDIO_KEY);
    if (!raw) return { volume: 1, muted: false };

    const parsed = JSON.parse(raw) as Partial<PlayerAudioPreference>;
    const volume =
      typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : 1;

    return {
      volume,
      muted: parsed.muted === true,
    };
  } catch {
    return { volume: 1, muted: false };
  }
}

export function writeAudioPreference(
  preference: PlayerAudioPreference,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      AUDIO_KEY,
      JSON.stringify({
        volume: Math.min(1, Math.max(0, preference.volume)),
        muted: preference.muted,
      }),
    );
  } catch {
    // Storage can be unavailable in private/restricted contexts.
  }
}

export function readSubtitlePreference(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(SUBTITLE_KEY);
  } catch {
    return null;
  }
}

export function writeSubtitlePreference(language: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (language) {
      window.localStorage.setItem(SUBTITLE_KEY, language);
    } else {
      window.localStorage.removeItem(SUBTITLE_KEY);
    }
  } catch {
    // Storage can be unavailable in private/restricted contexts.
  }
}
