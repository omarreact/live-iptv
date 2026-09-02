import { createFileRoute } from "@tanstack/react-router";
import { proxyStream } from "@/lib/iptv/proxy.server";

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => proxyStream(request),
    },
  },
});
