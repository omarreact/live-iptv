"use client";

import { Keyboard, Maximize2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  closestQualityIndex,
  detectPlaybackProtocol,
  qualityHeight,
} from "@/lib/media/protocol";
import type { BrowserPlaybackResult } from "@/types/media";
import {
  loadDashJs,
  type DashPlayer,
} from "./dash-loader.client";
import {
  readAudioPreference,
  readQualityPreference,
  readSubtitlePreference,
  writeAudioPreference,
  writeQualityPreference,
  writeSubtitlePreference,
} from "./player-preferences";
import {
  PlayerStateOverlay,
  type PlayerStatus,
} from "./player-state-overlay";
import {
  QualitySelector,
  type QualityOption,
} from "./quality-selector";
import { SubtitleSelector } from "./subtitle-selector";
import { usePlayerShortcuts } from "./use-player-shortcuts";

function topLevelSourceOptions(
  result: BrowserPlaybackResult,
): QualityOption[] {
  const heights = result.sources.map((source) => qualityHeight(source.quality));
  const bestHeight = Math.max(0, ...heights.map((height) => height ?? 0));

  return result.sources.map((source, index) => {
    const height = heights[index] ?? undefined;

    return {
      value: String(index),
      label: source.quality ?? detectPlaybackProtocol(source).toUpperCase(),
      height,
      detail: detectPlaybackProtocol(source).toUpperCase(),
      isBest: Boolean(height && height === bestHeight && bestHeight > 0),
    };
  });
}

function mediaErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code;

  if (code === MediaError.MEDIA_ERR_NETWORK) {
    return "The video connection was interrupted.";
  }

  if (code === MediaError.MEDIA_ERR_DECODE) {
    return "Your browser could not decode this video.";
  }

  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This source is not supported by your browser.";
  }

  return "Playback failed unexpectedly.";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const dashRef = useRef<DashPlayer | null>(null);
  const resumeAtRef = useRef(0);
  const resumePlayingRef = useRef(false);
  const hlsNetworkRetriesRef = useRef(0);
  const hlsMediaRetriesRef = useRef(0);
  const failedSourceIndexesRef = useRef<Set<number>>(new Set());

  const [sourceIndex, setSourceIndex] = useState(0);
  const [adaptiveQualities, setAdaptiveQualities] = useState<QualityOption[]>([]);
  const [adaptiveQuality, setAdaptiveQuality] = useState("auto");
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const source = result.sources[sourceIndex] ?? result.sources[0];
  const sourceOptions = useMemo(() => topLevelSourceOptions(result), [result]);

  const renderedAdaptiveQualities = useMemo(
    () =>
      adaptiveQualities.map((option) =>
        option.value === "auto" && currentHeight
          ? { ...option, label: `Auto · ${currentHeight}p` }
          : option,
      ),
    [adaptiveQualities, currentHeight],
  );

  const failCurrentSource = useCallback(
    (message: string) => {
      const video = videoRef.current;

      if (video) {
        resumeAtRef.current = video.currentTime || 0;
        resumePlayingRef.current = !video.paused;
      }

      const failed = failedSourceIndexesRef.current;
      failed.add(sourceIndex);

      const nextIndex = result.sources.findIndex(
        (_candidate, index) => index !== sourceIndex && !failed.has(index),
      );

      if (nextIndex >= 0) {
        setError(null);
        setStatus("loading");
        setSourceIndex(nextIndex);
        return;
      }

      setError(message);
      setStatus("error");
    },
    [result.sources, sourceIndex],
  );

  const retry = useCallback(() => {
    failedSourceIndexesRef.current.clear();
    setError(null);
    setStatus("loading");
    setRetryNonce((value) => value + 1);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen can be denied by browser/user policy.
    }
  }, []);

  usePlayerShortcuts({
    videoRef,
    onToggleFullscreen: toggleFullscreen,
  });

  useEffect(() => {
    failedSourceIndexesRef.current.clear();
    setSourceIndex(0);
    setError(null);
  }, [result]);

  useEffect(() => {
    if (sourceIndex >= result.sources.length) setSourceIndex(0);
  }, [result.sources.length, sourceIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const preference = readAudioPreference();
    video.volume = preference.volume;
    video.muted = preference.muted;

    const persistAudio = () =>
      writeAudioPreference({
        volume: video.volume,
        muted: video.muted,
      });

    video.addEventListener("volumechange", persistAudio);
    return () => video.removeEventListener("volumechange", persistAudio);
  }, []);

  useEffect(() => {
    const preferredLanguage = readSubtitlePreference();

    if (!preferredLanguage) {
      setSubtitleIndex(-1);
      return;
    }

    const preferredIndex = result.subtitles.findIndex(
      (subtitle) =>
        subtitle.language.toLowerCase() === preferredLanguage.toLowerCase(),
    );
    setSubtitleIndex(preferredIndex);
  }, [result.subtitles]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;

    let cancelled = false;
    const protocol = detectPlaybackProtocol(source);
    const preference = readQualityPreference();

    setError(null);
    setStatus("loading");
    setAdaptiveQualities([]);
    setAdaptiveQuality("auto");
    setCurrentHeight(null);

    hlsNetworkRetriesRef.current = 0;
    hlsMediaRetriesRef.current = 0;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    dashRef.current?.reset();
    dashRef.current = null;

    video.pause();
    video.removeAttribute("src");
    video.load();

    const restorePosition = () => {
      if (resumeAtRef.current > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(
          resumeAtRef.current,
          Math.max(0, video.duration - 0.1),
        );
      }

      if (resumePlayingRef.current || autoPlay) {
        void video.play().catch(() => undefined);
      }
    };

    const onLoadStart = () => setStatus("loading");
    const onWaiting = () => setStatus("loading");
    const onCanPlay = () =>
      setStatus((value) => (value === "playing" ? value : "ready"));
    const onPlaying = () => setStatus("playing");
    const onError = () => failCurrentSource(mediaErrorMessage(video));

    video.addEventListener("loadedmetadata", restorePosition);
    video.addEventListener("loadstart", onLoadStart);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);

    async function startPlayback() {
      if (protocol === "mp4") {
        video.src = source.url;
        return;
      }

      if (protocol === "hls") {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = source.url;
          setAdaptiveQualities([
            {
              value: "auto",
              label: "Auto",
              detail: "Native HLS",
              isBest: true,
            },
          ]);
          return;
        }

        const module = await import("hls.js");
        if (cancelled) return;

        const Hls = module.default;
        if (!Hls.isSupported()) {
          failCurrentSource("HLS playback is not supported by this browser.");
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          startLevel: -1,
          capLevelToPlayerSize: true,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const heights = hls.levels.map((level) => level.height || null);
          const bestHeight = Math.max(
            0,
            ...heights.map((height) => height ?? 0),
          );

          setAdaptiveQualities([
            {
              value: "auto",
              label: "Auto",
              detail: "Adaptive",
              isBest: true,
            },
            ...hls.levels.map((level, index) => ({
              value: `hls:${index}`,
              label: level.height
                ? `${level.height}p`
                : `${Math.round(level.bitrate / 1000)} kbps`,
              height: level.height || undefined,
              detail: `${Math.round(level.bitrate / 1000)} kbps`,
              isBest: Boolean(level.height && level.height === bestHeight),
            })),
          ]);

          if (preference.mode === "height") {
            const preferredIndex = closestQualityIndex(
              heights,
              preference.height,
            );

            if (preferredIndex >= 0) {
              hls.nextLevel = preferredIndex;
              setAdaptiveQuality(`hls:${preferredIndex}`);
            }
          } else {
            hls.nextLevel = -1;
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setCurrentHeight(hls.levels[data.level]?.height || null);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (
            data.type === Hls.ErrorTypes.NETWORK_ERROR &&
            hlsNetworkRetriesRef.current < 2
          ) {
            hlsNetworkRetriesRef.current += 1;
            setStatus("loading");
            hls.startLoad();
            return;
          }

          if (
            data.type === Hls.ErrorTypes.MEDIA_ERROR &&
            hlsMediaRetriesRef.current < 1
          ) {
            hlsMediaRetriesRef.current += 1;
            setStatus("loading");
            hls.recoverMediaError();
            return;
          }

          failCurrentSource("Unable to recover this HLS stream.");
        });

        hls.loadSource(source.url);
        hls.attachMedia(video);
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
        const bestHeight = Math.max(
          0,
          ...representations.map((representation) => representation.height ?? 0),
        );

        setAdaptiveQualities([
          {
            value: "auto",
            label: "Auto",
            detail: "Adaptive",
            isBest: true,
          },
          ...representations.map((representation, index) => ({
            value:
              representation.id !== undefined
                ? `dash:${String(representation.id)}`
                : `dash-index:${index}`,
            label: representation.height
              ? `${representation.height}p`
              : `${Math.round(
                  representation.bitrateInKbit ??
                    (representation.bandwidth ?? 0) / 1000,
                )} kbps`,
            height: representation.height,
            detail: `${Math.round(
              representation.bitrateInKbit ??
                (representation.bandwidth ?? 0) / 1000,
            )} kbps`,
            isBest: Boolean(
              representation.height &&
                representation.height === bestHeight,
            ),
          })),
        ]);

        if (preference.mode === "height") {
          const preferredIndex = closestQualityIndex(
            representations.map((representation) => representation.height),
            preference.height,
          );
          const representation = representations[preferredIndex];

          if (representation?.id !== undefined) {
            player.updateSettings({
              streaming: {
                abr: {
                  autoSwitchBitrate: {
                    video: false,
                  },
                },
              },
            });
            player.setRepresentationForTypeById(
              "video",
              representation.id,
              false,
            );
            setAdaptiveQuality(`dash:${String(representation.id)}`);
          }
        }
      });

      player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
        const representation = player.getCurrentRepresentationForType("video");
        setCurrentHeight(representation?.height ?? null);
      });

      player.on(dashjs.MediaPlayer.events.ERROR, () => {
        failCurrentSource("Unable to play this DASH stream.");
      });

      player.initialize(video, source.url, autoPlay || resumePlayingRef.current);
    }

    void startPlayback().catch((playbackError: unknown) => {
      console.error("[adaptive-player] initialization failed", playbackError);
      failCurrentSource("Unable to initialize playback.");
    });

    return () => {
      cancelled = true;

      video.removeEventListener("loadedmetadata", restorePosition);
      video.removeEventListener("loadstart", onLoadStart);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);

      hlsRef.current?.destroy();
      hlsRef.current = null;
      dashRef.current?.reset();
      dashRef.current = null;
    };
  }, [autoPlay, retryNonce, failCurrentSource, source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    Array.from(video.textTracks).forEach((track, index) => {
      track.mode = index === subtitleIndex ? "showing" : "disabled";
    });
  }, [sourceIndex, subtitleIndex, result.subtitles]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function changeSource(value: string): void {
    const nextIndex = Number(value);
    const video = videoRef.current;

    failedSourceIndexesRef.current.clear();

    if (video) {
      resumeAtRef.current = video.currentTime || 0;
      resumePlayingRef.current = !video.paused;
    }

    const next = sourceOptions[nextIndex];
    if (next?.height) {
      writeQualityPreference({ mode: "height", height: next.height });
    }

    setSourceIndex(nextIndex);
  }

  function changeSubtitle(index: number): void {
    setSubtitleIndex(index);
    writeSubtitlePreference(
      index >= 0 ? result.subtitles[index]?.language ?? null : null,
    );
  }

  function changeAdaptiveQuality(value: string): void {
    setAdaptiveQuality(value);

    if (value === "auto") {
      writeQualityPreference({ mode: "auto" });

      const hls = hlsRef.current;
      if (hls) hls.nextLevel = -1;

      const dash = dashRef.current;
      if (dash) {
        dash.updateSettings({
          streaming: {
            abr: {
              autoSwitchBitrate: {
                video: true,
              },
            },
          },
        });
      }
      return;
    }

    const option = adaptiveQualities.find((item) => item.value === value);
    if (option?.height) {
      writeQualityPreference({ mode: "height", height: option.height });
    }

    const hls = hlsRef.current;
    if (hls && value.startsWith("hls:")) {
      const level = Number(value.slice(4));
      if (Number.isInteger(level)) hls.nextLevel = level;
      return;
    }

    const dash = dashRef.current;
    if (!dash) return;

    dash.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: false,
          },
        },
      },
    });

    if (value.startsWith("dash:")) {
      dash.setRepresentationForTypeById("video", value.slice(5), false);
      return;
    }

    if (value.startsWith("dash-index:")) {
      const index = Number(value.slice(11));
      const representation = dash.getRepresentationsByType("video")[index];

      if (representation?.id !== undefined) {
        dash.setRepresentationForTypeById("video", representation.id, false);
      }
    }
  }

  if (!source) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black p-8 text-center text-sm text-white/65">
        No playable source is available.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "group/player overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/30"
      }
    >
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          poster={poster}
          className="size-full bg-black object-contain"
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

        <PlayerStateOverlay
          status={status}
          error={error}
          onRetry={retry}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent px-3 py-3 sm:px-4">
        {adaptiveQualities.length > 0 ? (
          <QualitySelector
            options={renderedAdaptiveQualities}
            value={adaptiveQuality}
            onChange={changeAdaptiveQuality}
            hideWhenSingle={false}
          />
        ) : (
          <QualitySelector
            options={sourceOptions}
            value={String(sourceIndex)}
            onChange={changeSource}
          />
        )}

        {adaptiveQualities.length > 0 && sourceOptions.length > 1 ? (
          <QualitySelector
            label="Source"
            options={sourceOptions}
            value={String(sourceIndex)}
            onChange={changeSource}
          />
        ) : null}

        <SubtitleSelector
          subtitles={result.subtitles}
          value={subtitleIndex}
          onChange={changeSubtitle}
        />

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 text-[11px] text-white/35 lg:flex">
            <Keyboard className="size-3.5" />
            Space · ←/→ 10s · ↑/↓ volume · M mute · F
          </div>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="grid size-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
