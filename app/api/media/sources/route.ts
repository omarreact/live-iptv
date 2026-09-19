import { getMediaSources } from "@/lib/media/bridge.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sources = await getMediaSources();
    return Response.json({ sources }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { sources: [], error: "Network media sources are not configured or currently unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
