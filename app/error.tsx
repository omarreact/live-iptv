"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Pinflix route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-2xl items-center px-4 py-16 sm:px-8">
      <div className="w-full rounded-xl bg-elevated p-8 text-center shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Pinflix</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">
          Something interrupted the signal
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          The live guide could not be loaded. Check your connection and try again.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
