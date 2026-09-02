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

export const fetchHome = createServerFn({ method: "GET" }).handler(async () => getHomeData());

export const fetchBrowse = createServerFn({ method: "GET" }).handler(async () => getBrowseData());

export const fetchCategory = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string(), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => getCategoryPage(data.id, data.offset ?? 0));

export const fetchCountry = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string(), category: z.string().optional(), offset: z.number().int().min(0).optional() }))
  .handler(async ({ data }) => getCountryPage(data.code, data.offset ?? 0, 96, data.category));

export const fetchSearch = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string() }))
  .handler(async ({ data }) => searchChannels(data.q));

export const fetchChannel = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const channel = await getChannel(data.id);
    if (!channel) return { channel: null, related: [] };
    return { channel, related: await getRelated(data.id) };
  });
