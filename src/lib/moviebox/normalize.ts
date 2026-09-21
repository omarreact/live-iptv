import type {
  MovieBoxDetailView,
  MovieBoxItem,
  MovieBoxSeason,
} from "./types";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringOrNumber(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function nestedRecord(record: UnknownRecord | null, key: string): UnknownRecord | null {
  return record ? asRecord(record[key]) : null;
}

function nestedString(record: UnknownRecord | null, key: string): string | null {
  return record ? asString(record[key]) : null;
}

function normalizeGenre(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(" · ");
  }
  return "";
}

function normalizeSeasons(value: unknown): MovieBoxSeason[] {
  if (!Array.isArray(value)) return [];

  const seasons: MovieBoxSeason[] = [];

  for (const entry of value) {
    const record = asRecord(entry);
    if (!record) continue;

    const se = Number(record.se);
    const maxEp = Number(record.maxEp);

    if (!Number.isFinite(se)) continue;

    seasons.push({
      se,
      maxEp: Number.isFinite(maxEp) && maxEp > 0 ? maxEp : 1,
    });
  }

  return seasons;
}

export function normalizeMovieBoxDetail(
  raw: unknown,
  fallback: MovieBoxItem,
): MovieBoxDetailView {
  const root = asRecord(raw);
  const subject = nestedRecord(root, "subject");
  const resource = nestedRecord(root, "resource");
  const cover = nestedRecord(subject, "cover");
  const trailer = nestedRecord(subject, "trailer");
  const videoAddress = nestedRecord(trailer, "videoAddress");

  const releaseDate = nestedString(subject, "releaseDate");
  const subjectId = subject ? asStringOrNumber(subject.subjectId) : null;
  const detailPath = nestedString(subject, "detailPath") ?? fallback.slug;

  return {
    subjectId: subjectId ?? fallback.subject_id,
    detailPath,
    title: nestedString(subject, "title") ?? fallback.name,
    description:
      nestedString(subject, "description") ??
      nestedString(root, "description") ??
      "",
    genre: normalizeGenre(subject?.genre),
    year: releaseDate ? releaseDate.slice(0, 4) : fallback.year ?? null,
    rating:
      (subject ? asStringOrNumber(subject.imdbRatingValue) : null) ??
      fallback.rating ??
      null,
    poster: nestedString(cover, "url") ?? fallback.poster_url,
    trailer: nestedString(videoAddress, "url"),
    seasons: normalizeSeasons(resource?.seasons),
  };
}
