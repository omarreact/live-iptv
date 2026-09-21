import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65dvh] max-w-2xl items-center px-4 py-16 sm:px-8">
      <div className="w-full text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
          Pinflix · 404
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
          Nothing is broadcasting here
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted">
          This channel or page may have moved, expired, or is not available in your region.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">Back to Live TV</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/search">
              <Search className="size-4" />
              Search Pinflix
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
