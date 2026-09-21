import { EntertainmentPageClient } from "@/components/entertainment-page";
import { getHome } from "@/lib/moviebox/service";

export const dynamic = "force-dynamic";

export default async function EntertainmentPage() {
  const initialHome = await getHome();

  return <EntertainmentPageClient initialHome={initialHome} />;
}
