export const CATEGORY_META: Record<string, { name: string; description: string }> = {
  news: { name: "News", description: "Live newsrooms and rolling coverage" },
  sports: { name: "Sports", description: "Matches, highlights, and sports talk" },
  kids: { name: "Kids", description: "Animation and children's programming" },
  movies: { name: "Movies", description: "Film channels from around the world" },
  documentary: { name: "Documentary", description: "The real world, on a loop" },
  entertainment: { name: "Entertainment", description: "Variety, talk, and pop culture" },
  music: { name: "Music", description: "Live music, videos, and radio TV" },
  series: { name: "Series", description: "Serialized drama and fiction" },
  science: { name: "Science", description: "Science, space, and technology" },
  culture: { name: "Culture", description: "Art, history, and the humanities" },
  business: { name: "Business", description: "Markets, money, and the economy" },
  weather: { name: "Weather", description: "Forecasts and storm tracking" },
  education: { name: "Education", description: "Learning and public knowledge" },
  lifestyle: { name: "Lifestyle", description: "Food, fashion, home, and health" },
  travel: { name: "Travel", description: "Places, journeys, and the road" },
  classic: { name: "Classic", description: "Programming from earlier decades" },
  comedy: { name: "Comedy", description: "Stand-up, sitcoms, and sketches" },
  cooking: { name: "Cooking", description: "Kitchens, recipes, and food TV" },
  family: { name: "Family", description: "Something for the whole room" },
  general: { name: "General", description: "Mixed programming, all-day" },
  public: { name: "Public", description: "Public service broadcasters" },
  religious: { name: "Religious", description: "Faith and spiritual programming" },
  outdoor: { name: "Outdoor", description: "Fishing, hunting, and the wild" },
  auto: { name: "Auto", description: "Cars, bikes, and the open road" },
  animation: { name: "Animation", description: "Drawn, rendered, in motion" },
  legislative: { name: "Legislative", description: "Government and civic proceedings" },
  relax: { name: "Relax", description: "Calm pictures and quiet sound" },
  shop: { name: "Shop", description: "Home shopping and marketplace TV" },
  interactive: { name: "Interactive", description: "Audience-driven programming" },
};

/**
 * Primary guide shelves — the ones we always surface first
 * on home, browse, and country/category filter chips.
 */
export const PRIMARY_CATEGORY_IDS = [
  "news",
  "sports",
  "kids",
  "movies",
  "documentary",
  "entertainment",
  "music",
  "series",
  "science",
  "culture",
  "business",
  "weather",
] as const;

export type PrimaryCategoryId = (typeof PRIMARY_CATEGORY_IDS)[number];

/** Home rows follow the same primary order. */
export const HOME_ROW_IDS = PRIMARY_CATEGORY_IDS;

const PRIMARY_RANK = new Map(PRIMARY_CATEGORY_IDS.map((id, index) => [id, index] as const));

/** Sort category ids: primary shelves first (fixed order), then by count desc. */
export function sortCategoryIds(ids: string[], counts?: Record<string, number>): string[] {
  return [...ids].sort((a, b) => {
    const ra = PRIMARY_RANK.get(a as PrimaryCategoryId);
    const rb = PRIMARY_RANK.get(b as PrimaryCategoryId);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    const ca = counts?.[a] ?? 0;
    const cb = counts?.[b] ?? 0;
    return cb - ca || a.localeCompare(b);
  });
}

export const FEATURED_NEEDLES = [
  "al jazeera english",
  "al jazeera",
  "france 24 english",
  "france 24",
  "dw english",
  "deutsche welle",
  "nhk world",
  "bloomberg",
  "nasa tv",
  "nasa",
  "euronews",
  "sky news",
  "abc news",
  "cbs news",
  "pbs",
  "c-span",
  "bbc news",
  "bbc world",
  "cnn international",
  "cnbc",
  "arirang",
  "tv5monde",
  "rai news",
  "cgtn",
  "trt world",
  "africanews",
];

export function categoryLabel(id: string): string {
  return CATEGORY_META[id]?.name ?? id;
}
