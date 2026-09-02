import { proxyStream } from "@/lib/iptv/proxy.server";

export async function GET(request: Request) {
  return proxyStream(request);
}
