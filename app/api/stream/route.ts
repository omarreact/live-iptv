import { proxyCatalogStream } from "@/lib/iptv/proxy.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyCatalogStream(request);
}
