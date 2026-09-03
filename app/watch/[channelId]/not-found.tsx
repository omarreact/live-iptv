import Link from "next/link";

export default function WatchNotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl tracking-tight">Channel not found</h1>
      <p className="mt-3 text-muted">That station may have dropped from the live guide.</p>
      <Link href="/" className="mt-6 text-sm text-fg underline underline-offset-4">
        Return home
      </Link>
    </main>
  );
}
