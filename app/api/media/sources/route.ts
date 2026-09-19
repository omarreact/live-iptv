import { getMediaSources } from "@/lib/media/bridge.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured =
    Boolean(process.env.PINFLIX_BD_BRIDGE_URL?.trim()) &&
    Boolean(process.env.PINFLIX_BD_BRIDGE_SECRET?.trim());

  if (!configured) {
    return Response.json(
      {
        sources: [],
        code: "BRIDGE_NOT_CONFIGURED",
        error: "The Pinflix network media bridge is not configured in this deployment.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const sources = await getMediaSources();
    return Response.json({ sources }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      {
        sources: [],
        code: "BRIDGE_UNAVAILABLE",
        error: "The Pinflix network media bridge is configured but currently unreachable.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
