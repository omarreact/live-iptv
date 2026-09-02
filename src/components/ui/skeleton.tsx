import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-elevated", className)}
      aria-hidden="true"
    />
  );
}

export { Skeleton };
