"use client";

import { ChevronDown, Gauge } from "lucide-react";

export type QualityOption = {
  value: string;
  label: string;
  detail?: string;
  height?: number;
  isBest?: boolean;
};

type Props = {
  label?: string;
  options: QualityOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hideWhenSingle?: boolean;
};

export function QualitySelector({
  label = "Quality",
  options,
  value,
  onChange,
  disabled = false,
  hideWhenSingle = true,
}: Props) {
  if (!options.length || (hideWhenSingle && options.length <= 1)) return null;

  const active = options.find((option) => option.value === value) ?? options[0];

  return (
    <label className="group relative inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 backdrop-blur-md transition hover:border-white/20 hover:bg-black/50">
      <Gauge className="size-4 shrink-0 text-white/60" aria-hidden="true" />

      <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45 sm:inline">
        {label}
      </span>

      <span className="max-w-28 truncate font-semibold">
        {active?.label ?? "Auto"}
        {active?.isBest ? (
          <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
            Best
          </span>
        ) : null}
      </span>

      <ChevronDown className="size-3.5 shrink-0 text-white/45" aria-hidden="true" />

      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.isBest ? " — Best" : ""}
            {option.detail ? ` (${option.detail})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
