import { getCatalog, toPublicChannel } from "@/lib/iptv/catalog.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await getCatalog();
  return Response.json(
    {
      channels: catalog.channels.map(toPublicChannel),
      categories: catalog.categories,
      fetchedAt: catalog.fetchedAt,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
