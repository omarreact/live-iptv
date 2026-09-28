import dns from "node:dns/promises";
import { NextResponse } from "next/server";
import { dghsConfigured, dghsEndpoint } from "@/lib/dghs-nid-proxy";
import { porichoyConfigured } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

type DnsResult = {
  ok: boolean;
  address?: string;
  code?: string;
};

type DohResult = {
  ok: boolean;
  status?: number;
  answers?: string[];
  error?: string;
};

type NetworkResult = {
  reachable: boolean;
  status: number | null;
  state: "reachable" | "degraded" | "unreachable";
  reason?: string;
};

async function diagnose(url: string) {
  const host = new URL(url).hostname;

  let dnsCheck: DnsResult = { ok: false };
  try {
    const resolved = await dns.lookup(host);
    dnsCheck = { ok: true, address: resolved.address };
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code || "DNS_ERROR")
        : "DNS_ERROR";
    dnsCheck = { ok: false, code };
  }

  let dohCheck: DohResult = { ok: false };
  try {
    const dohResponse = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`,
      { cache: "no-store" },
    );
    const dohBody = (await dohResponse.json()) as {
      Status?: number;
      Answer?: Array<{ data?: string }>;
    };
    dohCheck = {
      ok: dohResponse.ok && dohBody.Status === 0,
      status: dohBody.Status,
      answers: (dohBody.Answer || []).map((item) => String(item.data || "")).filter(Boolean),
    };
  } catch (error) {
    dohCheck = {
      ok: false,
      error: error instanceof Error ? error.name : "DOH_ERROR",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let network: NetworkResult = {
    reachable: false,
    status: null,
    state: "unreachable",
  };

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    network = {
      reachable: true,
      status: response.status,
      state: response.status >= 500 ? "degraded" : "reachable",
    };
  } catch (error) {
    network = {
      reachable: false,
      status: null,
      state: "unreachable",
      reason: error instanceof Error ? error.name : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }

  return { url, host, dns: dnsCheck, dnsOverHttps: dohCheck, network };
}

export async function GET() {
  const porichoyUrl = (process.env.PORICHOY_BASE_URL || "https://api.porichoybd.com").replace(/\/+$/, "");
  const dghsUrl = dghsEndpoint();

  const [porichoy, dghs] = await Promise.all([
    diagnose(porichoyUrl),
    diagnose(dghsUrl),
  ]);

  return NextResponse.json(
    {
      ok: true,
      providers: {
        porichoy: {
          configured: porichoyConfigured(),
          ...porichoy,
          ready: porichoyConfigured() && porichoy.network.reachable,
        },
        dghs: {
          configured: dghsConfigured(),
          ...dghs,
          ready: dghsConfigured() && dghs.network.reachable,
        },
      },
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
