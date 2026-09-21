"use client";

import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";

export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "error";

export function PlayerStateOverlay({
  status,
  error,
  onRetry,
}: {
  status: PlayerStatus;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "loading" && !error) {
    return (
      <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-lg">
          <LoaderCircle className="size-4 animate-spin" />
          Loading video…
        </div>
      </div>
    );
  }

  if (status !== "error" || !error) return null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-black/75 p-5 backdrop-blur-sm">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-500/15 text-red-300">
          <AlertTriangle className="size-6" />
        </span>
        <p className="mt-3 text-base font-bold text-white">
          Playback interrupted
        </p>
        <p className="mt-1 text-sm leading-6 text-white/60">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-white/90"
        >
          <RotateCcw className="size-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
