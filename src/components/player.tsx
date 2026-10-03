"use client";

import { useEffect, useRef, useState } from "react";
import type { SourceKind } from "@/lib/iptv/types";

type Destroyable = { destroy: () => void };

export function Player({
  channelId,
  name,
  sourceKinds,
  country,
}: {
  channelId: string;
  name: string;
  sourceKinds: SourceKind[];
  country?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<Destroyable | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("Connecting…");
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || sourceKinds.length === 0) {
      setFailed(true);
      setStatus("No stream source is available.");
      return;
    }

    let cancelled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    setFailed(false);
    setStatus(sourceIndex === 0 ? "Connecting…" : "Switching source…");

    const cleanupEngine = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = null;
      try {
        engineRef.current?.destroy();
      } catch {
        // Ignore third-party player cleanup errors.
      }
      engineRef.current = null;
      video.removeAttribute("src");
      video.load();
    };

    const fail = () => {
      if (cancelled) return;
      cleanupEngine();
      if (sourceIndex + 1 < sourceKinds.length) {
        setSourceIndex((value) => value + 1);
      } else {
        setFailed(true);
        setStatus("All available sources are currently unreachable.");
      }
    };

    const streamParams = new URLSearchParams({
      channel: channelId,
      source: String(sourceIndex),
    });
    if (country) streamParams.set("country", country);
    const src = "/api/stream?" + streamParams.toString();
    const kind = sourceKinds[sourceIndex] ?? "hls";

    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(fail, 14000);
    };

    const onPlaying = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = null;
      setStatus(sourceIndex === 0 ? "Live" : "Live · backup source " + String(sourceIndex + 1));
      setFailed(false);
    };
    const onWaiting = () => {
      setStatus("Buffering…");
      armWatchdog();
    };
    const onError = () => fail();

    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);
    video.addEventListener("error", onError);

    const play = async () => {
      try {
        await video.play();
      } catch {
        setStatus("Press play to start.");
      }
    };

    const attachHls = async (fallback?: () => void) => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        await play();
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (fallback) {
          fallback();
          return;
        }
        video.src = src;
        await play();
        return;
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 24,
        liveSyncDurationCount: 3,
        manifestLoadingTimeOut: 12000,
        fragLoadingTimeOut: 18000,
      });
      engineRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => void play());
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) fail();
      });
    };

    const attachMpegTs = async () => {
      const mod = await import("mpegts.js");
      const mpegts = mod.default;
      if (cancelled) return;
      if (!mpegts.isSupported()) {
        video.src = src;
        await play();
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
      void Promise.resolve(player.play()).catch(() => setStatus("Press play to start."));
      player.on(mpegts.Events.ERROR, fail);
    };

    const attach = async () => {
      armWatchdog();
      try {
        if (kind === "mp4") {
          video.src = src;
          await play();
        } else if (kind === "ts") {
          await attachMpegTs();
        } else {
          await attachHls(() => void attachMpegTs());
        }
      } catch {
        fail();
      }
    };

    void attach();

    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("error", onError);
      cleanupEngine();
    };
  }, [channelId, country, retry, sourceIndex, sourceKinds]);

  const toggleFullscreen = async () => {
    const el = videoRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el.requestFullscreen();
  };

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  };

  return (
    <section className="player-shell" aria-label={name + " player"}>
      <div className="player-stage">
        <video ref={videoRef} controls playsInline autoPlay preload="metadata" muted={muted} onVolumeChange={(e)=>setVolume(e.currentTarget.volume)} />
        {status !== "Live" && !status.startsWith("Live ·") ? <div className="player-loader"><span className="mini-spinner"/><b>{status}</b></div> : null}
        <div className="player-status" aria-live="polite">
          <span className={failed ? "status-dot status-error" : "status-dot"} />
          {status}
        </div>
      </div>
      <div className="player-toolbar">
        <span>
          Source {Math.min(sourceIndex + 1, Math.max(1, sourceKinds.length))} of {sourceKinds.length}
        </span>
        <div className="player-actions">
          <button type="button" onClick={()=>{const v=videoRef.current;if(v){v.muted=!v.muted;setMuted(v.muted)}}}>{muted ? "Unmute" : "Mute"}</button>
          <label className="volume-control" title="Volume"><span>VOL</span><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(e)=>{const v=videoRef.current;const n=Number(e.target.value);setVolume(n);if(v){v.volume=n;v.muted=n===0;setMuted(v.muted)}}}/></label>
          <button type="button" onClick={()=>void togglePip()}>PiP</button>
          <button type="button" onClick={()=>void toggleFullscreen()}>Fullscreen</button>
          {sourceIndex + 1 < sourceKinds.length ? (
            <button type="button" onClick={() => setSourceIndex((value) => value + 1)}>
              Try next source
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSourceIndex(0);
              setFailed(false);
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    </section>
  );
}
