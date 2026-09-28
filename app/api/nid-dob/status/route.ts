import { NextRequest, NextResponse } from "next/server";
import { dghsConfigured, dghsEndpoint } from "@/lib/dghs-nid-proxy";
import { isIdentityAuthorized, noStoreHeaders } from "@/lib/nid-dob-auth";
import { porichoyConfigured } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

type NetworkState = {
  reachable: boolean;
  status: number | null;
  state: "reachable" | "degraded" | "unreachable";
  reason?: string;
};

async function probe(url: string): Promise<NetworkState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      reachable: true,
      status: response.status,
      state: response.status >= 500 ? "degraded" : "reachable",
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      state: "unreachable",
      reason: error instanceof Error ? error.name : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  if (!isIdentityAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const porichoyBaseUrl = (process.env.PORICHOY_BASE_URL || "https://api.porichoybd.com").replace(/\/+$/, "");
  const dghsUrl = dghsEndpoint();

  const [porichoyNetwork, dghsNetwork] = await Promise.all([
    probe(porichoyBaseUrl),
    probe(dghsUrl),
  ]);

  const providers = {
    porichoy: {
      configured: porichoyConfigured(),
      network: porichoyNetwork,
      ready: porichoyConfigured() && porichoyNetwork.reachable,
    },
    dghs: {
      configured: dghsConfigured(),
      network: dghsNetwork,
      ready: dghsConfigured() && dghsNetwork.reachable,
      endpoint: dghsUrl,
    },
  };

  return NextResponse.json(
    {
      ok: true,
      providers,
      ready: providers.porichoy.ready || providers.dghs.ready,
      time: new Date().toISOString(),
    },
    { headers: noStoreHeaders() },
  );
}
