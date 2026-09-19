import { browseMediaSource } from "@/lib/media/bridge.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") ?? "";
  const path = url.searchParams.get("path") ?? "";

  try {
    const payload = await browseMediaSource(source, path);
    return Response.json(payload, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { error: "This media source is unavailable from the configured bridge." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
