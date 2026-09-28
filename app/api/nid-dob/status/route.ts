import { NextRequest, NextResponse } from "next/server";
import { isIdentityAuthorized, noStoreHeaders } from "@/lib/nid-dob-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isIdentityAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const baseUrl = (process.env.PORICHOY_BASE_URL || "https://api.porichoybd.com").replace(/\/+$/, "");
  const configured = Boolean(process.env.PORICHOY_API_KEY?.trim());

  let providerNetwork: {
    reachable: boolean;
    status: number | null;
    state: "reachable" | "degraded" | "unreachable";
    reason?: string;
  } = { reachable: false, status: null, state: "unreachable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

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
      porichoyConfigured: configured,
      providerNetwork,
      ready: configured && providerNetwork.reachable,
      time: new Date().toISOString(),
    },
    { headers: noStoreHeaders() },
  );
}
