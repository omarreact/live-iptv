import { getHome } from "@/lib/moviebox/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getHome();
  return Response.json(data, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
