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
  const [needsGesture, setNeedsGesture] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  // NOTE: Full file restore in progress - temporary partial
  return null;
}
