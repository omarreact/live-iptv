import dns from "node:dns/promises";
import { NextResponse } from "next/server";
import { porichoyConfigured } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  const baseUrl = (process.env.PORICHOY_BASE_URL || "https://api.porichoybd.com").replace(/\/+$/, "");
  const host = new URL(baseUrl).hostname;
  let dnsCheck: { ok: boolean; address?: string; code?: string } = { ok: false };

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

  let dohCheck: { ok: boolean; status?: number; answers?: string[]; error?: string } = { ok: false };
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
      dns: dnsCheck,
      dnsOverHttps: dohCheck,
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
