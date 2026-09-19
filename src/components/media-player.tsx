"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { MediaResolvePayload } from "@/lib/media/types";
import { cn } from "@/lib/utils";

type Destroyable = { destroy: () => void };

type PlaybackMode = "direct" | "transcode";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function MediaPlayer({ source, path, title }: { source: string; path: string; title: string }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<Destroyable | null>(null);
  const [resolved, setResolved] = useState<MediaResolvePayload | null>(null);
  const [mode, setMode] = useState<PlaybackMode>("direct");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResolved(null);
    setMode("direct");
    const params = new URLSearchParams({ source, path });
    fetch(`/api/media/resolve?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("resolve failed");
        return response.json() as Promise<MediaResolvePayload>;
      })
      .then((payload) => {
        setResolved(payload);
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string })?.name !== "AbortError") {
          setError("Pinflix could not resolve this video from the configured media bridge.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [source, path, retry]);

  useEffect(() => {
    if (!videoRef.current || !resolved) return;
    const video = videoRef.current;
    const media = resolved;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);

    const cleanupEngine = () => {
      try {
        engineRef.current?.destroy();
      } catch {
        // Ignore third-party player cleanup failures.
      }
      engineRef.current = null;
    };

    const fail = () => {
      if (cancelled) return;
      cleanupEngine();
      if (mode === "direct" && media.transcodeUrl) {
        setMode("transcode");
        return;
      }
      setLoading(false);
      setError("This video could not be decoded in the browser. Check the bridge and FFmpeg configuration.");
    };

    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
      setError(null);
    };
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrent(video.currentTime || 0);
    const onDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onError = () => fail();

    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("loadedmetadata", onDuration);
    video.addEventListener("error", onError);

    async function attachHls(url: string) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        await video.play().catch(() => {});
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) return fail();
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 45,
        fragLoadingTimeOut: 30_000,
        manifestLoadingTimeOut: 20_000,
      });
      engineRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) fail();
      });
    }

    async function attachTranscode(url: string) {
      const mod = await import("mpegts.js");
      const mpegts = mod.default;
      if (cancelled) return;
      if (!mpegts.isSupported()) return fail();
      const player = mpegts.createPlayer(
        { type: "mpegts", isLive: false, url, cors: true },
        { enableWorker: true, enableStashBuffer: true, lazyLoad: true },
      );
      engineRef.current = player;
      player.attachMediaElement(video);
      player.load();
      void Promise.resolve(player.play()).catch(() => {});
      player.on(mpegts.Events.ERROR, () => fail());
    }

    async function attach() {
      try {
        cleanupEngine();
        video.removeAttribute("src");
        video.load();
        if (mode === "transcode") {
          await attachTranscode(media.transcodeUrl);
          return;
        }
        if (media.kind === "hls") {
          await attachHls(media.url);
          return;
        }
        video.src = media.url;
        await video.play().catch(() => {
          if (!media.directPlayable) fail();
        });
      } catch {
        fail();
      }
    }

    void attach();
    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("loadedmetadata", onDuration);
      video.removeEventListener("error", onError);
      cleanupEngine();
      video.removeAttribute("src");
      video.load();
    };
  }, [resolved, mode]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await wrap.requestFullscreen().catch(() => {});
  }, []);

  function changeVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video || !duration || mode === "transcode") return;
    video.currentTime = value;
    setCurrent(value);
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <div ref={wrapRef} className="relative flex min-h-dvh flex-col bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 size-full bg-black object-contain"
          onClick={togglePlay}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/70" />

        <div className="relative z-10 flex items-start gap-3 p-3 sm:p-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="tv-focus flex size-10 shrink-0 items-center justify-center rounded-full bg-black/45 backdrop-blur hover:bg-black/70"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-sm font-semibold sm:text-base">{title || resolved?.title || "Pinflix video"}</p>
            <p className="mt-0.5 truncate text-xs text-white/60">
              {resolved?.source.name ?? "Network media"}
              {mode === "transcode" ? " · Compatibility mode" : " · Direct playback"}
            </p>
          </div>
        </div>

        {loading && !error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/60 px-4 py-2 text-sm text-white/75 backdrop-blur">
              {mode === "transcode" ? "Preparing compatible stream…" : "Opening video…"}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md rounded-2xl border border-white/10 bg-neutral-950/90 p-6 text-center shadow-2xl backdrop-blur">
              <p className="text-xl font-semibold">Playback unavailable</p>
              <p className="mt-2 text-sm leading-6 text-white/60">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setMode("direct");
                  setRetry((value) => value + 1);
                }}
                className="tv-focus mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black"
              >
                <RotateCcw className="size-4" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative z-10 mt-auto p-3 sm:p-5">
          <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md sm:p-4">
            <div className="mb-3 flex items-center gap-3 text-[11px] text-white/55">
              <span>{formatTime(current)}</span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={1}
                value={Math.min(current, duration || 1)}
                disabled={!duration || mode === "transcode"}
                onChange={(event) => seek(Number(event.target.value))}
                className={cn("h-1 flex-1 accent-white", mode === "transcode" && "opacity-35")}
                aria-label="Seek"
              />
              <span>{duration ? formatTime(duration) : mode === "transcode" ? "LIVE" : "--:--"}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="tv-focus flex size-10 items-center justify-center rounded-full bg-white text-black"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="tv-focus flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                className="hidden h-1 w-24 accent-white sm:block"
                aria-label="Volume"
              />

              <span className="ml-2 hidden rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/55 sm:inline-flex">
                {mode === "transcode" ? "FFmpeg compatibility" : resolved?.kind === "hls" ? "HLS" : resolved?.mimeType || "Video"}
              </span>

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="tv-focus ml-auto flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Fullscreen"
              >
                {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
