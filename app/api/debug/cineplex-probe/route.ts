export const dynamic = "force-dynamic";

export async function GET() {
  const healthUrl = "https://media.pincodeit.com/health";
  const upstream = "http://vod.cineplexbd.net:8081/";
  const proxyUrl =
    "https://media.pincodeit.com/proxy?url=" +
    encodeURIComponent(upstream);

  const started = Date.now();

  const result = {
    checkedAt: new Date().toISOString(),
    health: null as null | {
      status: number;
      ok: boolean;
      body: string;
      ms: number;
    },
    proxyRoot: null as null | {
      status: number;
      ok: boolean;
      location: string | null;
      server: string | null;
      contentType: string | null;
      bodyPreview: string;
      ms: number;
    },
  };

  const hStart = Date.now();
  try {
    const res = await fetch(healthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    result.health = {
      status: res.status,
      ok: res.ok,
      body: (await res.text()).slice(0, 500),
      ms: Date.now() - hStart,
    };
  } catch (error) {
    result.health = {
      status: 0,
      ok: false,
      body: error instanceof Error ? error.message : String(error),
      ms: Date.now() - hStart,
    };
  }

  const pStart = Date.now();
  try {
    const res = await fetch(proxyUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    result.proxyRoot = {
      status: res.status,
      ok: res.ok,
      location: res.headers.get("location"),
      server: res.headers.get("server"),
      contentType: res.headers.get("content-type"),
      bodyPreview: (await res.text()).slice(0, 500),
      ms: Date.now() - pStart,
    };
  } catch (error) {
    result.proxyRoot = {
      status: 0,
      ok: false,
      location: null,
      server: null,
      contentType: null,
      bodyPreview: error instanceof Error ? error.message : String(error),
      ms: Date.now() - pStart,
    };
  }

  return Response.json({
    ...result,
    totalMs: Date.now() - started,
  });
}
