export const dynamic = "force-dynamic";

export async function GET() {
  const edge = "https://media.pincodeit.com";
  const target = "http://vod.cineplexbd.net:8081/";

  const startedAt = Date.now();

  let health: Record<string, unknown>;
  try {
    const response = await fetch(edge + "/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    health = {
      ok: response.ok,
      status: response.status,
      text: (await response.text()).slice(0, 300),
    };
  } catch (error) {
    health = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let proxy: Record<string, unknown>;
  try {
    const url = new URL("/proxy", edge);
    url.searchParams.set("url", target);

    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });

    proxy = {
      ok: response.ok || response.status === 302,
      status: response.status,
      location: response.headers.get("location"),
      server: response.headers.get("server"),
      contentType: response.headers.get("content-type"),
      body: (await response.text()).slice(0, 300),
    };
  } catch (error) {
    proxy = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return Response.json({
    testedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    edge,
    target,
    health,
    proxy,
  });
}
