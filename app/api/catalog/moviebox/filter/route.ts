export const dynamic = "force-dynamic";

/** @deprecated Use /api/moviebox/search or category endpoints instead */
export async function GET() {
  return Response.json(
    {
      source: "moviebox-public",
      fetchedAt: new Date().toISOString(),
      total: 0,
      limited: false,
      items: [],
      deprecated: true,
      message: "This endpoint is deprecated.",
    },
    {
      headers: { "cache-control": "no-store" },
    },
  );
}
