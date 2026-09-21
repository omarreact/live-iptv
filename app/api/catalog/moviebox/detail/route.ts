/** @deprecated */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { deprecated: true, message: "Endpoint removed" },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
