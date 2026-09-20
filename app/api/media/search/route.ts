import { searchMediaSource } from "@/lib/media/bridge.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") ?? "";
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "24");

  try {
    const payload = await searchMediaSource(source, query, limit);
    return Response.json(payload, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        source: { id: source, name: "CineplexBD", description: "" },
        query,
        items: [],
        error: "CineplexBD search is unavailable from the configured bridge.",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
