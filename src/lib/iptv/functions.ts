import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getBrowseData,
  getCategoryPage,
  getChannel,
  getCountryPage,
  getHomeData,
  getRelated,
  searchChannels,
} from "./catalog.server";

export const fetchHome = createServerFn({ method: "GET" }).handler(async () => {
  return getHomeData();
});

export const fetchBrowse = createServerFn({ method: "GET" }).handler(async () => {
  return getBrowseData();
});

export const fetchCategory = createServerFn({ method: "GET" })
  .validator(
    z.object({
      id: z.string(),
      offset: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ data }) => {
    return getCategoryPage(data.id, data.offset ?? 0);
  });

export const fetchCountry = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z.string(),
      offset: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ data }) => {
    return getCountryPage(data.code, data.offset ?? 0);
  });

export const fetchSearch = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string() }))
  .handler(async ({ data }) => {
    return searchChannels(data.q);
  });

export const fetchChannel = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const channel = await getChannel(data.id);
    if (!channel) return { channel: null, related: [] };
    const related = await getRelated(data.id);
    return { channel, related };
  });
