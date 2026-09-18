import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg",
        "placeholder:text-subtle",
        "transition-colors hover:border-border-strong",
        "focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
