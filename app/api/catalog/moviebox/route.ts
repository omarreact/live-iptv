/** @deprecated Use /api/moviebox/home */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      deprecated: true,
      message: "Use /api/moviebox/home",
      rows: [],
      fetchedAt: new Date().toISOString(),
    },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
