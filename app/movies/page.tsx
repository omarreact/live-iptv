import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movies",
  description: "Browse the live Pinflix movie catalog.",
};

export default function MoviesPage() {
  redirect("/entertainment?view=movies");
}
