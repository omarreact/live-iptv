import "server-only";

import { recordStreamFailure, recordStreamSuccess } from "./health";
import { assertSafeUrl } from "./proxy.server";
import {
  openPrivateTarget,
  resolvePrivateTarget,
  sealPrivateTarget,
  type ResolvedPrivateTarget,
} from "./private-stream.server";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const MAX_REDIRECTS = 4;
const MAX_TOKEN_LENGTH = 12_000;

type PrivateContext = {
  channelId: string;
  sourceId: string;
  targetOverride: string | null;
};

function requestContext(incoming: URL): PrivateContext {
  const sealed = incoming.searchParams.get("pt");
  if (sealed) {
    if (sealed.length > MAX_TOKEN_LENGTH) throw new Error("Private stream token is too long");
    const payload = openPrivateTarget(sealed);
    return { channelId: payload.c, sourceId: payload.s, targetOverride: payload.u };
  }

  const channelId = incoming.searchParams.get("pc")?.trim() ?? "";
  const sourceId = incoming.searchParams.get("ps")?.trim() ?? "";
  if (!channelId || !sourceId) throw new Error("Missing private channel source");
  return { channelId, sourceId, targetOverride: null };
}

function isPlaylist(url: URL, contentType: string): boolean {
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith(".m3u8") ||
    path.endsWith(".m3u") ||
    path.endsWith(".smil") ||
    /mpegurl|x-mpegurl|apple\.mpegurl|vnd\.apple/i.test(contentType)
  );
}

function privateProxyUrl(
  origin: string,
  channelId: string,
  sourceId: string,
  target: string,
): string {
  const sealed = sealPrivateTarget(channelId, sourceId, target);
  return `${origin}/api/stream?pt=${encodeURIComponent(sealed)}`;
}

function rewritePlaylist(
  text: string,
  base: string,
  origin: string,
  channelId: string,
  sourceId: string,
): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          try {
            return `URI="${privateProxyUrl(
              origin,
              channelId,
              sourceId,
              new URL(uri, base).href,
            )}"`;
          } catch {
            return 'URI=""';
          }
        });
      }

      try {
        return privateProxyUrl(origin, channelId, sourceId, new URL(trimmed, base).href);
      } catch {
        return "";
      }
    })
    .join("\n");
}

function responseHeaders(upstream: Response, fallbackType?: string): Headers {
  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") || fallbackType || "application/octet-stream",
  );
  headers.set("cache-control", "no-store");
  headers.set("x-accel-buffering", "no");
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function fetchPrivateUpstream(
  initial: URL,
  request: Request,
  resolved: ResolvedPrivateTarget,
): Promise<{ response: Response; finalUrl: URL }> {
  let current = initial;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const headers = new Headers(resolved.headers);
    if (!headers.has("user-agent")) headers.set("user-agent", DEFAULT_UA);
    headers.set("accept", "*/*");

    const range = request.headers.get("range");
    if (range) headers.set("range", range);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);
    let upstream: Response;
    try {
      upstream = await fetch(current, {
        headers,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status < 300 || upstream.status >= 400) {
      return { response: upstream, finalUrl: current };
    }

    if (redirect === MAX_REDIRECTS) throw new Error("Too many bridge redirects");
    const location = upstream.headers.get("location");
    if (!location) throw new Error("Invalid bridge redirect");

    const next = assertSafeUrl(new URL(location, current).href);
    if (next.origin !== initial.origin) {
      throw new Error("Cross-origin bridge redirect blocked");
    }
    current = next;
  }

  throw new Error("Private bridge redirect failed");
}

export function isPrivateProxyRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.has("pc") || url.searchParams.has("pt");
}

export async function proxyPrivateStream(request: Request): Promise<Response> {
  const incoming = new URL(request.url);

  let context: PrivateContext;
  let resolved: ResolvedPrivateTarget;
  let target: URL;
  try {
    context = requestContext(incoming);
    resolved = await resolvePrivateTarget(
      context.channelId,
      context.sourceId,
      context.targetOverride,
    );
    target = assertSafeUrl(resolved.target);
  } catch {
    return new Response("Private stream is unavailable", {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  const startedAt = Date.now();
  let result: { response: Response; finalUrl: URL };
  try {
    result = await fetchPrivateUpstream(target, request, resolved);
  } catch {
    recordStreamFailure(resolved.healthKey, Date.now() - startedAt);
    return new Response("This channel is temporarily unavailable", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }

  const { response: upstream, finalUrl } = result;
  if (!upstream.ok && upstream.status !== 206) {
    recordStreamFailure(resolved.healthKey, Date.now() - startedAt);
    return new Response("This channel is temporarily unavailable", {
      status: 502,
      headers: responseHeaders(upstream, "text/plain; charset=utf-8"),
    });
  }

  recordStreamSuccess(resolved.healthKey, Date.now() - startedAt);

  const contentType = upstream.headers.get("content-type") ?? "";
  if (isPlaylist(finalUrl, contentType)) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(
      text,
      finalUrl.href,
      incoming.origin,
      context.channelId,
      context.sourceId,
    );
    return new Response(rewritten, {
      status: 200,
      headers: responseHeaders(upstream, "application/vnd.apple.mpegurl"),
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders(upstream),
  });
}
