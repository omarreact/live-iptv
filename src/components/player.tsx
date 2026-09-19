"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toChannelPreview, type Channel, type ChannelPreview } from "@/lib/iptv/types";
import { proxiedStreamUrl, streamKind } from "@/lib/iptv/stream";
import { useLibrary } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChannelCard } from "./channel-card";
import { StreamLoader } from "./loading";
import { Button } from "./ui/button";

type Destroyable = { destroy: () => void };

type MobileVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

type EpgProgram = { title: string; start: string; end: string };
type EpgPayload = {
  now: EpgProgram | null;
  next: EpgProgram | null;
  metadata: { id: number; mediaType: "movie" | "tv"; title: string; overview: string; posterPath: string | null } | null;
};

export function Player({ channel, related }: { channel: Channel; related: ChannelPreview[] }) {
  const channelPreview = useMemo(() => toChannelPreview(channel), [channel]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const engineRef = useRef<Destroyable | null>(null);
  const router = useRouter();
  const toggleSaved = useLibrary((s) => s.toggleSaved);
  const addRecent = useLibrary((s) => s.addRecent);
  const saved = useLibrary((s) => s.saved.some((c) => c.id === channel.id));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [streamIndex, setStreamIndex] = useState(0);
  const [transport, setTransport] = useState<"proxy" | "direct">("proxy");
  const [epg, setEpg] = useState<EpgPayload | null>(null);

  useEffect(() => {
    addRecent(channelPreview);
  }, [channelPreview, addRecent]);

  useEffect(() => {
    setStreamIndex(0);
    setTransport("proxy");
  }, [channel.id]);

  useEffect(() => {
    const controller = new AbortController();
    setEpg(null);
    fetch("/api/epg?channel=" + encodeURIComponent(channel.id), { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<EpgPayload>) : null))
      .then((data) => {
        if (data) setEpg(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [channel.id]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setChromeVisible(false);
    }, 2800);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const video: HTMLVideoElement = el;
    let cancelled = false;
    setError(null);
    setStarted(false);
    setPlaying(false);
    const activeStream = channel.streams?.[streamIndex] ??
      channel.streams?.[0] ?? {
        id: `${channel.id}:legacy`,
        url: channel.url,
        title: channel.name,
        feed: null,
        quality: channel.quality,
        label: null,
        geoBlocked: channel.geoBlocked,
        not247: channel.not247,
        userAgent: channel.userAgent,
        referrer: channel.referrer,
      };
    const activeChannel = {
      ...channel,
      url: activeStream.url,
      quality: activeStream.quality,
      geoBlocked: activeStream.geoBlocked,
      not247: activeStream.not247,
      userAgent: activeStream.userAgent,
      referrer: activeStream.referrer,
    };
    const directEligible = (() => {
      try {
        const url = new URL(activeStream.url);
        const isIpHost = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname);
        return (
          url.protocol === "https:" &&
          !isIpHost &&
          !activeStream.userAgent &&
          !activeStream.referrer
        );
      } catch {
        return false;
      }
    })();
    const src = transport === "proxy" ? proxiedStreamUrl(activeChannel) : activeStream.url;
    const kind = streamKind(activeStream.url);
    const hasNextStream = (channel.streams?.length ?? 0) > streamIndex + 1;

    function fail(message?: string, status?: number) {
      if (cancelled) return;

      // A concrete proxy error means the upstream source itself failed.
      // Skip it immediately when a ranked backup exists instead of retrying
      // the same origin directly and making the viewer wait through two failures.
      if (transport === "proxy" && status && status >= 400 && hasNextStream) {
        setTransport("proxy");
        setStreamIndex((n) => n + 1);
        return;
      }

      // If the proxy failed without an upstream HTTP status (for example a
      // network/TLS path the viewer's browser may still reach), direct fallback
      // is safe only for clean HTTPS hostnames.
      if (transport === "proxy" && directEligible) {
        setTransport("direct");
        return;
      }

      if (hasNextStream) {
        setTransport("proxy");
        setStreamIndex((n) => n + 1);
        return;
      }

      setStarted(false);
      setError(message ?? "This channel is temporarily unavailable.");
    }

    const onPlaying = () => {
      setPlaying(true);
      setStarted(true);
      setError(null);
    };
    const onPause = () => setPlaying(false);
    const onError = () => fail();
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    async function attachHls(onFatal?: () => void) {
      const native = video.canPlayType("application/vnd.apple.mpegurl");
      if (native) {
        video.src = src;
        await video.play().catch(() => {});
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (onFatal) {
          onFatal();
          return;
        }
        video.src = src;
        await video.play().catch(() => fail("Live playback is not supported in this browser."));
        return;
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        liveSyncDurationCount: 3,
        fragLoadingTimeOut: 25000,
        manifestLoadingTimeOut: 25000,
      });
      engineRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        const d = data as { fatal?: boolean; response?: { code?: number } };
        if (!d?.fatal) return;
        const status = d.response?.code;
        hls.destroy();
        engineRef.current = null;
        if (onFatal) onFatal();
        else fail(undefined, status);
      });
    }
    async function attachMpegTs() {
      const mod = await import("mpegts.js");
      const mpegts = mod.default;
      if (cancelled) return;
      if (!mpegts.isSupported()) {
        video.src = src;
        await video.play().catch(() => fail("Live playback is not supported in this browser."));
        return;
      }
      const player = mpegts.createPlayer(
        { type: "mpegts", isLive: true, url: src, cors: true },
        {
          enableWorker: true,
          isLive: true,
          enableStashBuffer: false,
          liveBufferLatencyChasing: true,
          lazyLoad: false,
        },
      );
      engineRef.current = player;
      player.attachMediaElement(video);
      player.load();
      void Promise.resolve(player.play()).catch(() => {});
      player.on(mpegts.Events.ERROR, () => fail());
    }
    async function attach() {
      try {
        if (kind === "mp4") {
          video.src = src;
          await video.play().catch(() => {});
          return;
        }
        if (kind === "hls") {
          await attachHls();
          return;
        }
        await attachHls(() => {
          void attachMpegTs();
        });
      } catch {
        fail();
      }
    }
    void attach();
    revealChrome();
    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      try {
        engineRef.current?.destroy();
      } catch {
        /* ignore */
      }
      engineRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [channel, revealChrome, retry, streamIndex, transport]);

  const isMobileLike = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  }, []);

  const lockLandscape = useCallback(async () => {
    if (!isMobileLike()) return;
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!orientation?.lock) return;
    try {
      await orientation.lock("landscape");
    } catch {
      // Some browsers expose Screen Orientation but still disallow locking.
    }
  }, [isMobileLike]);

  const unlockOrientation = useCallback(() => {
    const orientation = screen.orientation as LockableOrientation | undefined;
    try {
      orientation?.unlock?.();
    } catch {
      // Ignore browsers that do not permit explicit unlocks.
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current as MobileVideoElement | null;

    const onFs = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (active) void lockLandscape();
      else unlockOrientation();
    };
    const onWebkitBegin = () => {
      setFullscreen(true);
      void lockLandscape();
    };
    const onWebkitEnd = () => {
      setFullscreen(false);
      unlockOrientation();
    };

    document.addEventListener("fullscreenchange", onFs);
    video?.addEventListener("webkitbeginfullscreen", onWebkitBegin as EventListener);
    video?.addEventListener("webkitendfullscreen", onWebkitEnd as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      video?.removeEventListener("webkitbeginfullscreen", onWebkitBegin as EventListener);
      video?.removeEventListener("webkitendfullscreen", onWebkitEnd as EventListener);
      unlockOrientation();
    };
  }, [lockLandscape, unlockOrientation]);
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    revealChrome();
  }, [revealChrome]);
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    revealChrome();
  }, [revealChrome]);
  const toggleFs = useCallback(async () => {
    const el = wrapRef.current;
    const video = videoRef.current as MobileVideoElement | null;
    if (!el || !video) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      unlockOrientation();
      return;
    }

    if (video.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.();
      unlockOrientation();
      return;
    }

    try {
      await el.requestFullscreen();
      await lockLandscape();
      return;
    } catch {
      // iPhone Safari may only offer native video fullscreen.
    }

    if (video.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
        await lockLandscape();
      } catch {
        // Keep playback inline when native fullscreen is unavailable.
      }
    }
  }, [lockLandscape, unlockOrientation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") toggleMute();
      else if (e.key === "f") void toggleFs();
      else if (e.key === "ArrowRight" && related[0]) router.push(`/watch/${related[0].id}`);
      else if (e.key === "Escape" && !document.fullscreenElement) router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [related, router, togglePlay, toggleMute, toggleFs]);

  function onVolume(v: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    video.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  }
  const next = related[0];
  const previous = related[1];
  const nowProgress = epg?.now
    ? Math.max(
        0,
        Math.min(
          100,
          ((Date.now() - new Date(epg.now.start).getTime()) /
            Math.max(1, new Date(epg.now.end).getTime() - new Date(epg.now.start).getTime())) *
            100,
        ),
      )
    : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      <div
        ref={wrapRef}
        className="relative flex h-[58dvh] min-h-72 flex-1 flex-col bg-bg lg:h-auto lg:min-h-dvh"
        onMouseMove={revealChrome}
        onTouchStart={revealChrome}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 size-full bg-bg object-contain"
          playsInline
          autoPlay
          onClick={togglePlay}
        />
        {!started && !error ? (
          <StreamLoader
            label={
              transport === "direct" || streamIndex > 0
                ? "Switching to a healthier source"
                : "Connecting to live signal"
            }
          />
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md space-y-4 rounded-xl border border-border bg-surface p-6 text-center">
              <p className="text-xl font-semibold">Signal lost</p>
              <p className="text-sm text-muted">{error}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTransport("proxy");
                    setStreamIndex(0);
                    setRetry((n) => n + 1);
                  }}
                >
                  <RotateCcw className="size-4" />
                  Retry
                </Button>
                {next ? (
                  <Button asChild>
                    <Link href={`/watch/${next.id}`}>
                      <SkipForward className="size-4" />
                      Try next
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" asChild>
                  <Link href="/">Back home</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/50",
            "transition-opacity duration-200",
            chromeVisible ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-3 sm:p-4",
            "transition-[opacity,transform] duration-200 ease-out",
            chromeVisible ? "opacity-100" : "pointer-events-none opacity-0 -translate-y-1",
          )}
        >
          <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back">
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="truncate font-medium">{channel.shortName}</p>
            <p className="truncate text-xs text-muted">
              {epg?.now?.title ?? ([channel.country, channel.quality].filter(Boolean).join(" · ") || "Live TV")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={saved ? "Remove from saved" : "Save channel"}
            onClick={() => toggleSaved(channelPreview)}
          >
            <Bookmark className={cn("size-5", saved && "fill-current")} />
          </Button>
        </div>
        {epg?.now ? (
          <div
            className={cn(
              "absolute inset-x-0 bottom-14 z-10 px-4 sm:bottom-16 sm:px-5",
              "transition-[opacity,transform] duration-200 ease-out",
              chromeVisible ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0",
            )}
          >
            <div className="mx-auto max-w-4xl">
              <div className="flex items-end justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{epg.now.title}</p>
                  {epg.next ? <p className="mt-0.5 truncate text-muted">Next: {epg.next.title}</p> : null}
                </div>
                <span className="shrink-0 font-medium text-brand">LIVE</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-brand" style={{ width: `${nowProgress}%` }} />
              </div>
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 p-3 sm:gap-3 sm:p-4",
            "transition-[opacity,transform] duration-200 ease-out",
            chromeVisible ? "opacity-100" : "pointer-events-none opacity-0 translate-y-1",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="size-5 fill-current ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-5" />
            ) : (
              <Volume2 className="size-5" />
            )}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="hidden h-1 w-24 cursor-pointer accent-accent sm:block"
            aria-label="Volume"
          />
          <div className="ml-auto flex items-center gap-2">
            {previous ? (
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/watch/${previous.id}`} aria-label="Previous channel">
                  <SkipBack className="size-5" />
                </Link>
              </Button>
            ) : null}
            {next ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/watch/${next.id}`}>Next</Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void toggleFs()}
              aria-label="Fullscreen"
            >
              {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </Button>
          </div>
        </div>
      </div>
      <aside className="border-t border-border bg-surface lg:h-dvh lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-t-0">
        <div className="px-4 py-4">
          <h2 className="text-base font-semibold">More channels</h2>
        </div>
        <div className="hide-scrollbar flex gap-3 overflow-x-auto px-4 pb-6 lg:flex-col lg:overflow-x-visible">
          {related.map((ch) => (
            <ChannelCard key={ch.id} channel={ch} className="w-40 lg:w-full" />
          ))}
        </div>
      </aside>
    </div>
  );
}
