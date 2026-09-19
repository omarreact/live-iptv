import { MediaPlayer } from "@/components/media-player";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MediaWatchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const source = first(params.source);
  const path = first(params.path);
  const title = first(params.title) || "Pinflix video";

  if (!source || !path) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black p-6 text-white">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Video source missing</h1>
          <p className="mt-2 text-sm text-white/60">Open a video from the Entertainment network library.</p>
        </div>
      </main>
    );
  }

  return <MediaPlayer source={source} path={path} title={title} />;
}
