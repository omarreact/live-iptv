import { Film, Radio, Search } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { cn } from "@/lib/utils";

export function PinflixLoader({
  label = "Loading Pinflix",
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        compact ? "py-2" : "min-h-40 flex-col py-8",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("pinflix-loader-orbit", compact ? "size-11" : "size-16")}>
        <span className="pinflix-loader-ring pinflix-loader-ring-a" />
        <span className="pinflix-loader-ring pinflix-loader-ring-b" />
        <span className="pinflix-loader-core">
          <LogoMark className={compact ? "size-5" : "size-7"} />
        </span>
        <span className="pinflix-loader-signal" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
      </div>
      <div className={cn("text-center", compact && "text-left")}>
        <p className="text-sm font-medium text-fg">{label}</p>
        {!compact ? <p className="mt-1 text-xs text-subtle">Tuning the fastest available source…</p> : null}
      </div>
    </div>
  );
}

export function Shimmer({ className, rounded = "rounded-xl" }: { className?: string; rounded?: string }) {
  return <div aria-hidden="true" className={cn("pinflix-shimmer bg-surface", rounded, className)} />;
}

export function ChannelCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div className={cn("shrink-0", featured ? "w-64 sm:w-72" : "w-40 sm:w-44")} aria-hidden="true">
      <Shimmer className="aspect-video w-full border border-border" />
      <Shimmer className="mt-2.5 h-4 w-3/4" rounded="rounded-md" />
      <Shimmer className="mt-1.5 h-3 w-2/5" rounded="rounded-md" />
    </div>
  );
}

export function ChannelCardsSkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="hide-scrollbar flex gap-3.5 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => <ChannelCardSkeleton key={index} />)}
    </div>
  );
}

export function ChannelGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="min-w-0">
          <Shimmer className="aspect-video w-full border border-border" />
          <Shimmer className="mt-2.5 h-4 w-3/4" rounded="rounded-md" />
          <Shimmer className="mt-1.5 h-3 w-2/5" rounded="rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="max-w-2xl" aria-hidden="true">
      <Shimmer className="h-3 w-24" rounded="rounded-md" />
      <Shimmer className="mt-3 h-10 w-72 max-w-[80vw]" rounded="rounded-lg" />
      <Shimmer className="mt-3 h-4 w-[32rem] max-w-[85vw]" rounded="rounded-md" />
    </div>
  );
}

export function HomeLoading() {
  return (
    <main className="relative pb-14">
      <LoadingBeam />
      <section className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex items-center justify-between gap-5">
          <div>
            <Shimmer className="h-8 w-28" rounded="rounded-lg" />
            <Shimmer className="mt-2 h-4 w-52" rounded="rounded-md" />
          </div>
          <PinflixLoader label="Syncing live guide" compact className="hidden sm:flex" />
        </div>
        <Shimmer className="mt-5 h-12 max-w-2xl border border-border" />
      </section>
      <div className="mx-auto max-w-[1400px] space-y-10">
        {Array.from({ length: 3 }).map((_, index) => (
          <section key={index}>
            <div className="px-4 sm:px-6 lg:px-8"><Shimmer className="h-7 w-36" rounded="rounded-md" /></div>
            <div className="mt-4 px-4 sm:px-6 lg:px-8"><ChannelCardsSkeletonRow count={7} /></div>
          </section>
        ))}
      </div>
    </main>
  );
}

export function CatalogLoading({ label = "Loading channels" }: { label?: string }) {
  return (
    <main className="relative mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <LoadingBeam />
      <div className="flex items-start justify-between gap-6">
        <PageHeaderSkeleton />
        <PinflixLoader label={label} compact className="hidden md:flex" />
      </div>
      <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => <Shimmer key={index} className="h-9 w-20" rounded="rounded-lg" />)}
      </div>
      <div className="mt-8"><ChannelGridSkeleton count={18} /></div>
    </main>
  );
}

export function SearchLoadingState() {
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex size-9 items-center justify-center rounded-full border border-brand/25 bg-brand/10 text-brand">
          <Search className="size-4 pinflix-search-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium">Searching every source</p>
          <p className="text-xs text-subtle">Fastest results appear first.</p>
        </div>
      </div>
      <ChannelGridSkeleton count={12} />
    </div>
  );
}

export function SavedLoadingState() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeaderSkeleton />
      <section className="mt-9">
        <Shimmer className="h-6 w-28" rounded="rounded-md" />
        <div className="mt-4"><ChannelGridSkeleton count={6} /></div>
      </section>
    </main>
  );
}

export function EntertainmentLoading() {
  return (
    <main className="relative mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <LoadingBeam />
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-brand">
            <Film className="size-5" />
            <Shimmer className="h-3 w-28" rounded="rounded-md" />
          </div>
          <Shimmer className="mt-3 h-10 w-72 max-w-[80vw]" rounded="rounded-lg" />
          <Shimmer className="mt-3 h-4 w-[34rem] max-w-[85vw]" rounded="rounded-md" />
        </div>
        <PinflixLoader label="Curating your screen" compact className="hidden md:flex" />
      </div>
      <Shimmer className="mt-6 h-11 max-w-2xl border border-border" />
      <div className="mt-9">
        <Shimmer className="h-6 w-44" rounded="rounded-md" />
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 18 }).map((_, index) => (
            <div key={index}>
              <Shimmer className="aspect-[2/3] w-full border border-border" />
              <Shimmer className="mt-2.5 h-4 w-4/5" rounded="rounded-md" />
              <Shimmer className="mt-1.5 h-3 w-1/2" rounded="rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function StreamLoader({ label = "Connecting to live signal" }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-[2] flex items-center justify-center overflow-hidden bg-bg">
      <div className="pinflix-player-scan" aria-hidden="true" />
      <div className="relative z-10 rounded-2xl border border-border bg-bg/80 px-8 py-7 text-center backdrop-blur-md">
        <PinflixLoader label={label} />
        <div className="mt-1 flex items-end justify-center gap-1" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="pinflix-eq-bar w-1 rounded-full bg-brand" style={{ animationDelay: `${index * 70}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function WatchLoading() {
  return (
    <main className="relative min-h-dvh bg-bg">
      <LoadingBeam />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute inset-0 pinflix-watch-grid opacity-40" aria-hidden="true" />
        <PinflixLoader label="Opening live channel" />
      </div>
    </main>
  );
}

export function LoadingBeam() {
  return <div className="pinflix-loading-beam" aria-hidden="true" />;
}

export function EmptySignalLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <Radio className="size-4 text-brand pinflix-search-pulse" />
      <span>{label}</span>
    </div>
  );
}
