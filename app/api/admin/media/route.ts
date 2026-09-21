import { NextResponse } from "next/server";
import { addAdminMedia, listAdminMedia } from "@/lib/admin-catalog.server";
import type { PlaybackProtocol } from "@/types/media";

export const runtime = "nodejs";

const protocols = new Set<PlaybackProtocol>(["mp4", "hls", "dash"]);

function isAuthorized(request: Request): boolean {
  const expected = process.env.PINFLIX_ADMIN_PASSWORD?.trim();
  return Boolean(expected && request.headers.get("x-admin-password") === expected);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeUrl(value: unknown): string | null {
  const raw = text(value, 2_000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ items: await listAdminMedia() });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const title = text(body.title, 160);
  const kind = body.kind === "series" ? "series" : "movie";
  const protocol = protocols.has(body.protocol as PlaybackProtocol)
    ? (body.protocol as PlaybackProtocol)
    : null;
  const sourceUrl = safeUrl(body.sourceUrl);

  if (!title || !protocol || !sourceUrl) {
    return NextResponse.json(
      { error: "Title, protocol, and a valid HTTP(S) source URL are required." },
      { status: 400 },
    );
  }

  const entry = await addAdminMedia({
    title,
    kind,
    year: text(body.year, 4) || null,
    poster: safeUrl(body.poster),
    overview: text(body.overview, 2_000),
    protocol,
    sourceUrl,
    subtitleUrl: safeUrl(body.subtitleUrl),
    subtitleLanguage: text(body.subtitleLanguage, 40) || null,
  });

  return NextResponse.json({ item: entry }, { status: 201 });
}
