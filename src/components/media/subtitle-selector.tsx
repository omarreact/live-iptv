"use client";

import type { PlaybackSubtitle } from "@/types/media";

type Props = {
  subtitles: PlaybackSubtitle[];
  value: number;
  onChange: (index: number) => void;
};

export function SubtitleSelector({ subtitles, value, onChange }: Props) {
  if (!subtitles.length) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Subtitles</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
      >
        <option value={-1}>Off</option>
        {subtitles.map((subtitle, index) => (
          <option key={`${subtitle.language}-${subtitle.url}`} value={index}>
            {subtitle.label}
          </option>
        ))}
      </select>
    </label>
  );
}
