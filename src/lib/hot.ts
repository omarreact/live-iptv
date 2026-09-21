import { getNowNext } from "./iptv/epg";
import { getChannelById } from "./iptv/provider/iptv-org";
import { getFastCategoryChannels } from "./iptv/provider/multi";

export type HotItem = {
  id: string;
  kind: "sport" | "alert" | "news";
  title: string;
  subtitle: string;
  href: string;
  external?: boolean;
};

const HOT_TIMEOUT_MS = 2_200;

function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code.toUpperCase();
  }
}


async function timeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), HOT_TIMEOUT_MS)),
  ]);
}

async function sportsItems(country: string): Promise<HotItem[]> {
  let result = await getFastCategoryChannels("sports", 8, country);
  if (!result.channels.length) result = await getFastCategoryChannels("sports", 8);

  const candidates = result.channels.slice(0, 5);
  const programmes = await Promise.all(
    candidates.map(async (preview) => {
      const channel = await timeout(getChannelById(preview.id), null);
      if (!channel?.guide) return null;

      const guide = await timeout(
        getNowNext(channel.guide).catch(() => ({ now: null, next: null })),
        { now: null, next: null },
      );
      if (!guide.now?.title) return null;

      return {
        id: `sport-${preview.id}`,
        kind: "sport" as const,
        title: guide.now.title,
        subtitle: `Live now on ${preview.shortName}`,
        href: `/watch/${preview.id}`,
      };
    }),
  );

  const live = programmes.filter((item): item is HotItem => Boolean(item));
  if (live.length) return live.slice(0, 3);

  const first = candidates[0];
  return first
    ? [
        {
          id: `sport-${first.id}`,
          kind: "sport",
          title: "Live sports available now",
          subtitle: `Watch ${first.shortName}`,
          href: `/watch/${first.id}`,
        },
      ]
    : [];
}

type GdacsRow = Record<string, unknown>;

function readString(row: GdacsRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function alertItems(country: string): Promise<HotItem[]> {
  const response = await fetch("https://www.gdacs.org/contentdata/xml/homepage_datatable.json", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(2_500),
    next: { revalidate: 300 },
  }).catch(() => null);

  if (!response?.ok) return [];

  const payload = (await response.json().catch(() => null)) as
    | GdacsRow[]
    | { data?: GdacsRow[]; aaData?: GdacsRow[] }
    | null;

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.aaData)
        ? payload.aaData
        : [];

  const label = countryName(country).toLowerCase();
  const code = country.toLowerCase();

  return rows
    .filter((row) => {
      const haystack = JSON.stringify(row).toLowerCase();
      if (!haystack.includes(label) && !haystack.includes(`"${code}"`)) return false;
      return /red|orange/.test(haystack);
    })
    .slice(0, 2)
    .map((row, index) => {
      const title =
        readString(row, ["title", "eventname", "event_name", "name", "description"]) ||
        `Emergency alert for ${countryName(country)}`;
      const href =
        readString(row, ["url", "link", "reporturl", "report_url"]) || "https://www.gdacs.org/";

      return {
        id: `alert-${index}-${title}`,
        kind: "alert" as const,
        title,
        subtitle: "Verified disaster alert · GDACS",
        href,
        external: true,
      };
    });
}

async function newsItem(country: string): Promise<HotItem[]> {
  const result = await getFastCategoryChannels("news", 4, country);
  const first = result.channels[0];
  if (!first) return [];

  return [
    {
      id: `news-${first.id}`,
      kind: "news",
      title: `${countryName(country)} live news`,
      subtitle: `Watch ${first.shortName}`,
      href: `/watch/${first.id}`,
    },
  ];
}

export async function getHotNow(country: string): Promise<HotItem[]> {
  const [alerts, sports, news] = await Promise.all([
    alertItems(country).catch(() => []),
    sportsItems(country).catch(() => []),
    newsItem(country).catch(() => []),
  ]);

  return [...alerts, ...sports, ...news].slice(0, 5);
}
