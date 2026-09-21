export const dynamic = "force-dynamic";

/** @deprecated Use /api/moviebox/home instead */
export async function GET() {
  return Response.json(
    {
      source: "moviebox-public",
      fetchedAt: new Date().toISOString(),
      rows: [],
      deprecated: true,
      message: "This endpoint is deprecated. Use /api/moviebox/home",
    },
    {
      headers: { "cache-control": "no-store" },
    },
  );
}
