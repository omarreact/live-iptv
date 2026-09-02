import { searchChannels } from "@/lib/iptv/catalog.server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const rows = await searchChannels(q, 60);
  return Response.json(rows);
}
