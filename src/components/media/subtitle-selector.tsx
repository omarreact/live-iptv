"use client";

import { Captions, ChevronDown } from "lucide-react";
import type { PlaybackSubtitle } from "@/types/media";

type Props = {
  subtitles: PlaybackSubtitle[];
  value: number;
  onChange: (index: number) => void;
  disabled?: boolean;
};

export function SubtitleSelector({
  subtitles,
  value,
  onChange,
  disabled = false,
}: Props) {
  if (!subtitles.length) return null;

  const active = value >= 0 ? subtitles[value] : null;

  return (
    <label className="group relative inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 backdrop-blur-md transition hover:border-white/20 hover:bg-black/50">
      <Captions className="size-4 shrink-0 text-white/60" aria-hidden="true" />

      <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45 sm:inline">
        Subtitles
      </span>

      <span className="max-w-32 truncate font-semibold">
        {active?.label ?? "Off"}
      </span>

      <span
        className={
          active
            ? "size-1.5 rounded-full bg-emerald-400"
            : "size-1.5 rounded-full bg-white/25"
        }
        aria-hidden="true"
      />

      <ChevronDown className="size-3.5 shrink-0 text-white/45" aria-hidden="true" />

      <select
        aria-label="Subtitles"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      >
        <option value={-1}>Off</option>
        {subtitles.map((item, index) => (
          <option key={`${item.language}-${item.url}`} value={index}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
