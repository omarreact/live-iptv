/** @deprecated Use /api/moviebox/search or category endpoints */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      deprecated: true,
      message: "Use /api/moviebox/search",
      items: [],
      total: 0,
    },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
