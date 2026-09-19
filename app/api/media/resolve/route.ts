import { resolveMediaSource } from "@/lib/media/bridge.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") ?? "";
  const path = url.searchParams.get("path") ?? "";

  try {
    const payload = await resolveMediaSource(source, path);
    return Response.json(payload, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Pinflix could not resolve this video from the network source." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
