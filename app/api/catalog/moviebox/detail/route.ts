export const dynamic = "force-dynamic";

/** @deprecated */
export async function GET() {
  return Response.json(
    { error: "This endpoint is deprecated." },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
