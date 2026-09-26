export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET =
  "http://vod.cineplexbd.net:8081/movies/Hindi%20Dubbed/Tamil%20Movies/2026/Irumudi%20(2026)%201080P/Irumudi%20(2026)%20WEB-DL%20%5BHindi-Telugu%5D%20NF%201080p%20ESub.mp4/index.m3u8";

type ProbeResult = {
  status: number;
  ok: boolean;
  ms: number;
  contentType: string | null;
  contentLength: string | null;
  location: string | null;
  preview: string;
  error?: string;
};

async function probe(url: string): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
      },
    });

    const type = response.headers.get("content-type");
    const canPreview =
      response.ok &&
      (type?.includes("mpegurl") ||
        type?.includes("text") ||
        url.toLowerCase().includes(".m3u8"));
    const preview = canPreview ? (await response.text()).slice(0, 600) : "";

    return {
      status: response.status,
      ok: response.ok,
      ms: Date.now() - started,
      contentType: type,
      contentLength: response.headers.get("content-length"),
      location: response.headers.get("location"),
      preview,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      ms: Date.now() - started,
      contentType: null,
      contentLength: null,
      location: null,
      preview: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const gateway =
    "https://media.pincodeit.com/proxy?url=" + encodeURIComponent(TARGET);

  const [direct, viaGateway] = await Promise.all([
    probe(TARGET),
    probe(gateway),
  ]);

  return Response.json(
    {
      checkedAt: new Date().toISOString(),
      targetHost: "vod.cineplexbd.net:8081",
      direct,
      gateway: viaGateway,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
