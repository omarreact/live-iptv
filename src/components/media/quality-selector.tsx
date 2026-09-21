"use client";

export type QualityOption = {
  value: string;
  label: string;
};

type Props = {
  label?: string;
  options: QualityOption[];
  value: string;
  onChange: (value: string) => void;
};

export function QualitySelector({
  label = "Quality",
  options,
  value,
  onChange,
}: Props) {
  if (options.length <= 1) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
