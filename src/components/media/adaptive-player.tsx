"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowserPlaybackResult } from "@/types/media";
import { QualitySelector, type QualityOption } from "./quality-selector";
import { SubtitleSelector } from "./subtitle-selector";

const DASH_JS_URL = "https://cdn.dashjs.org/v5.2.1/dash.all.min.js";

type DashRepresentation = {
  height?: number;
  bandwidth?: number;
  bitrateInKbit?: number;
};

type DashPlayer = {
  initialize(
    video: HTMLVideoElement,
    source: string,
    autoPlay?: boolean,
  ): void;
  reset(): void;
  updateSettings(settings: Record<string, unknown>): void;
  getRepresentationsByType(type: "video"): DashRepresentation[];
  setRepresentationForTypeByIndex(
    type: "video",
    index: number,
    forceReplace?: boolean,
  ): void;
  on(event: string, listener: () => void): void;
};

type DashMediaPlayerFactory = {
  (): { create(): DashPlayer };
  events: {
    STREAM_INITIALIZED: string;
    ERROR: string;
  };
};

type DashGlobal = {
  MediaPlayer: DashMediaPlayerFactory;
};

declare global {
  interface Window {
    dashjs?: DashGlobal;
  }
}

let dashLoader: Promise<DashGlobal> | null = null;

function loadDashJs(): Promise<DashGlobal> {
  if (window.dashjs) return Promise.resolve(window.dashjs);
  if (dashLoader) return dashLoader;

  dashLoader = new Promise<DashGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${DASH_JS_URL}"]`,
    );

    const resolveGlobal = () => {
      if (window.dashjs) {
        resolve(window.dashjs);
      } else {
        reject(new Error("dash.js loaded without exposing the player API"));
      }
    };

    if (existing) {
      existing.addEventListener("load", resolveGlobal, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load dash.js")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = DASH_JS_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", resolveGlobal, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load dash.js")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    dashLoader = null;
    throw error;
  });

  return dashLoader;
}

function topLevelSourceOptions(
  result: BrowserPlaybackResult,
): QualityOption[] {
  return result.sources.map((source, index) => ({
    value: String(index),
    label: source.quality ?? source.protocol.toUpperCase(),
  }));
}

export function AdaptivePlayer({
  result,
  poster,
  autoPlay = false,
  className,
}: {
  result: BrowserPlaybackResult;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const dashRef = useRef<DashPlayer | null>(null);
  const resumeAt = useRef(0);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [adaptiveQualities, setAdaptiveQualities] = useState<QualityOption[]>([]);
  const [adaptiveQuality, setAdaptiveQuality] = useState("auto");
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const source = result.sources[sourceIndex] ?? result.sources[0];
  const sourceOptions = useMemo(() => topLevelSourceOptions(result), [result]);

  useEffect(() => {
    if (sourceIndex >= result.sources.length) setSourceIndex(0);
  }, [result.sources.length, sourceIndex]);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || !source) return;

    let cancelled = false;

    setError(null);
    setAdaptiveQualities([]);
    setAdaptiveQuality("auto");

    hlsRef.current?.destroy();
    hlsRef.current = null;
    dashRef.current?.reset();
    dashRef.current = null;

    media.pause();
    media.removeAttribute("src");
    media.load();

    const restoreTime = () => {
      if (resumeAt.current > 0 && Number.isFinite(media.duration)) {
        media.currentTime = Math.min(resumeAt.current, media.duration || resumeAt.current);
      }
    };

    media.addEventListener("loadedmetadata", restoreTime);

    async function startPlayback() {
      if (source.protocol === "mp4") {
        media.src = source.url;
        if (autoPlay) await media.play().catch(() => undefined);
        return;
      }

      if (source.protocol === "hls") {
        if (media.canPlayType("application/vnd.apple.mpegurl")) {
          media.src = source.url;
          if (autoPlay) await media.play().catch(() => undefined);
          return;
        }

        const module = await import("hls.js");
        if (cancelled) return;

        const Hls = module.default;
        if (!Hls.isSupported()) {
          setError("HLS playback is not supported by this browser.");
          return;
        }

        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setAdaptiveQualities([
            { value: "auto", label: "Auto" },
            ...hls.levels.map((level, index) => ({
              value: String(index),
              label: level.height
                ? `${level.height}p`
                : `${Math.round(level.bitrate / 1000)} kbps`,
            })),
          ]);

          if (autoPlay) void media.play().catch(() => undefined);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }

          setError("Unable to play this HLS stream.");
        });

        hls.loadSource(source.url);
        hls.attachMedia(media);
        return;
      }

      const dashjs = await loadDashJs();
      if (cancelled) return;

      const player = dashjs.MediaPlayer().create();
      dashRef.current = player;

      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              audio: true,
              video: true,
            },
          },
        },
      });

      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        const representations = player.getRepresentationsByType("video");
        setAdaptiveQualities([
          { value: "auto", label: "Auto" },
          ...representations.map((representation, index) => ({
            value: String(index),
            label: representation.height
              ? `${representation.height}p`
              : `${Math.round(
                  representation.bitrateInKbit ??
                    (representation.bandwidth ?? 0) / 1000,
                )} kbps`,
          })),
        ]);
      });

      player.on(dashjs.MediaPlayer.events.ERROR, () => {
        setError("Unable to play this DASH stream.");
      });

      player.initialize(media, source.url, autoPlay);
    }

    void startPlayback().catch((playbackError: unknown) => {
      console.error("[adaptive-player] initialization failed", playbackError);
      setError("Unable to initialize playback.");
    });

    return () => {
      cancelled = true;
      media.removeEventListener("loadedmetadata", restoreTime);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      dashRef.current?.reset();
      dashRef.current = null;
    };
  }, [autoPlay, source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    Array.from(video.textTracks).forEach((track, index) => {
      track.mode = index === subtitleIndex ? "showing" : "disabled";
    });
  }, [sourceIndex, subtitleIndex, result.subtitles]);

  function changeSource(value: string): void {
    const video = videoRef.current;
    if (video) resumeAt.current = video.currentTime || 0;
    setSourceIndex(Number(value));
  }

  function changeAdaptiveQuality(value: string): void {
    setAdaptiveQuality(value);

    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = value === "auto" ? -1 : Number(value);
      return;
    }

    const dash = dashRef.current;
    if (!dash) return;

    dash.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: value === "auto",
          },
        },
      },
    });

    if (value !== "auto") {
      dash.setRepresentationForTypeByIndex("video", Number(value), true);
    }
  }

  if (!source) {
    return (
      <div className="rounded-xl bg-black p-8 text-center text-sm text-white/70">
        No playable source available.
      </div>
    );
  }

  return (
    <div className={className ?? "space-y-3"}>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster}
        className="aspect-video w-full rounded-xl bg-black"
      >
        {result.subtitles.map((subtitle) => (
          <track
            key={`${subtitle.language}-${subtitle.url}`}
            kind="subtitles"
            src={subtitle.url}
            srcLang={subtitle.language}
            label={subtitle.label}
          />
        ))}
      </video>

      <div className="flex flex-wrap items-center gap-3">
        <QualitySelector
          label="Source"
          options={sourceOptions}
          value={String(sourceIndex)}
          onChange={changeSource}
        />

        <QualitySelector
          options={adaptiveQualities}
          value={adaptiveQuality}
          onChange={changeAdaptiveQuality}
        />

        <SubtitleSelector
          subtitles={result.subtitles}
          value={subtitleIndex}
          onChange={setSubtitleIndex}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
