export const dynamic = "force-dynamic";

async function probe(url: string, timeoutMs = 12000) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
        referer: "http://cineplexbd.net/",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      status: res.status,
      ok: res.ok || (res.status >= 300 && res.status < 400),
      location: res.headers.get("location"),
      server: res.headers.get("server"),
      contentType: res.headers.get("content-type"),
      bodyPreview: (await res.text()).slice(0, 300),
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    };
  }
}

export async function GET() {
  const edge = "https://media.pincodeit.com";

  const edge80 = new URL("/proxy", edge);
  edge80.searchParams.set("url", "http://cineplexbd.net/");

  const edge8081 = new URL("/proxy", edge);
  edge8081.searchParams.set("url", "http://vod.cineplexbd.net:8081/");

  const [health, direct80, direct8081, proxied80, proxied8081] =
    await Promise.all([
      probe(edge + "/health", 10000),
      probe("http://cineplexbd.net/", 12000),
      probe("http://vod.cineplexbd.net:8081/", 12000),
      probe(edge80.href, 15000),
      probe(edge8081.href, 15000),
    ]);

  return Response.json({
    checkedAt: new Date().toISOString(),
    health,
    direct80,
    direct8081,
    proxied80,
    proxied8081,
  });
}
