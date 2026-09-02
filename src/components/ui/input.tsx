import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-lg bg-elevated px-3.5 text-sm text-fg shadow-[var(--shadow-border)]",
        "placeholder:text-subtle",
        "transition-[box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
