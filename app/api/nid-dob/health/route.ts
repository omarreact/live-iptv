import { NextResponse } from "next/server";
import { porichoyConfigured } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  const baseUrl = (process.env.PORICHOY_BASE_URL || "https://api.porichoybd.com").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  let providerNetwork: {
    reachable: boolean;
    status: number | null;
    state: "reachable" | "degraded" | "unreachable";
    reason?: string;
  } = { reachable: false, status: null, state: "unreachable" };

  try {
    const response = await fetch(baseUrl, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    providerNetwork = {
      reachable: true,
      status: response.status,
      state: response.status >= 500 ? "degraded" : "reachable",
    };
  } catch (error) {
    providerNetwork = {
      reachable: false,
      status: null,
      state: "unreachable",
      reason: error instanceof Error ? error.name : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }

  return NextResponse.json(
    {
      ok: true,
      porichoyConfigured: porichoyConfigured(),
      providerNetwork,
      ready: porichoyConfigured() && providerNetwork.reachable,
      time: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        pragma: "no-cache",
        "x-robots-tag": "noindex, nofollow, noarchive, nosnippet",
      },
    },
  );
}
