import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full rounded-xl border border-border bg-surface/90 px-4 text-sm text-fg shadow-[var(--shadow-border)] backdrop-blur-sm",
        "placeholder:text-subtle",
        "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
        "hover:border-border-strong hover:bg-elevated",
        "focus-visible:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
