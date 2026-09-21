import { EntertainmentDetailPlayer } from "@/components/entertainment/detail-player";
import {
  normalizeMovieBoxItem,
  normalizeMovieBoxMediaDetail,
} from "@/lib/media/normalize-moviebox";
import { normalizeMovieBoxDetail } from "@/lib/moviebox/normalize";
import { getDetail } from "@/lib/moviebox/service";
import type { MovieBoxItem } from "@/lib/moviebox/types";
import type { MediaDetail } from "@/types/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Watch | Pinflix Entertainment",
  description: "Watch movies and series on a dedicated Pinflix playback page.",
};

type Params = Promise<{ slug: string }>;

function fallbackItem(slug: string): MovieBoxItem {
  return {
    name: "Entertainment title",
    poster_url: null,
    slug,
    subject_id: null,
    kind: "mixed",
  };
}

function fallbackDetail(item: MovieBoxItem, slug: string): MediaDetail {
  const base = normalizeMovieBoxItem(item);

  return {
    ...base,
    detailKey: slug,
    overview:
      "Full title details are temporarily unavailable. Please return to Entertainment and try again.",
    genres: [],
    trailer: null,
    seasons: [],
    playback: null,
  };
}

export default async function EntertainmentTitlePage({
  params,
}: {
  params: Params;
}) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.trim().slice(0, 512);
  const fallback = fallbackItem(slug);

  let detail: MediaDetail;

  try {
    detail = normalizeMovieBoxMediaDetail(
      normalizeMovieBoxDetail(await getDetail(slug), fallback),
      fallback,
    );
  } catch (error: unknown) {
    console.error("[entertainment.detail] failed", error);
    detail = fallbackDetail(fallback, slug);
  }

  return (
    <EntertainmentDetailPlayer
      detail={detail}
      backHref="/entertainment"
    />
  );
}
