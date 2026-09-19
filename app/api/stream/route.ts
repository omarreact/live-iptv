import { isPrivateProxyRequest, proxyPrivateStream } from "@/lib/iptv/private-proxy.server";
import { proxyStream } from "@/lib/iptv/proxy.server";

export async function GET(request: Request) {
  if (isPrivateProxyRequest(request)) return proxyPrivateStream(request);
  return proxyStream(request);
}
