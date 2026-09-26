export const dynamic = "force-dynamic";

async function probe(url: string, timeoutMs: number) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
        referer: "http://cineplexbd.net/",
      },
    });
    return {
      ok: response.ok || (response.status >= 300 && response.status < 400),
      status: response.status,
      elapsedMs: Date.now() - started,
      location: response.headers.get("location"),
      server: response.headers.get("server"),
      contentType: response.headers.get("content-type"),
      body: (await response.text()).slice(0, 300),
    };
  } catch (error) {
    return {
      ok: false,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const edge = "https://media.pincodeit.com";

  const health = await probe(edge + "/health", 10000);

  const edge80 = new URL("/proxy", edge);
  edge80.searchParams.set("url", "http://cineplexbd.net/");

  const edge8081 = new URL("/proxy", edge);
  edge8081.searchParams.set("url", "http://vod.cineplexbd.net:8081/");

  const [direct80, direct8081, proxied80, proxied8081] = await Promise.all([
    probe("http://cineplexbd.net/", 12000),
    probe("http://vod.cineplexbd.net:8081/", 12000),
    probe(edge80.href, 15000),
    probe(edge8081.href, 15000),
  ]);

  return Response.json({
    testedAt: new Date().toISOString(),
    edge,
    health,
    direct80,
    direct8081,
    proxied80,
    proxied8081,
  });
}
