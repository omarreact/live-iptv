export const dynamic = "force-dynamic";

async function probe(url: string, timeoutMs: number) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
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

  const port80 = new URL("/proxy", edge);
  port80.searchParams.set("url", "http://cineplexbd.net/");

  const port8081 = new URL("/proxy", edge);
  port8081.searchParams.set("url", "http://vod.cineplexbd.net:8081/");

  const [web80, vod8081] = await Promise.all([
    probe(port80.href, 15000),
    probe(port8081.href, 15000),
  ]);

  return Response.json({
    testedAt: new Date().toISOString(),
    edge,
    health,
    web80,
    vod8081,
  });
}
