import type { ChannelPreview } from "../types";
import { getChannelsByCategory, getChannelsByCountry } from "./iptv-org";
import { getNexusCategoryChannels, getNexusCountryChannels } from "./nexus";

type ProviderResult = {
  provider: "nexus" | "iptv-org";
  channels: ChannelPreview[];
};

async function requireChannels(result: ProviderResult): Promise<ProviderResult> {
  if (!result.channels.length) throw new Error(`${result.provider} returned no channels`);
  return result;
}

export async function getFastCountryChannels(
  country: string,
  limit = 18,
): Promise<ProviderResult> {
  const code = country.trim().toUpperCase();

  const nexus = getNexusCountryChannels(code, limit).then((channels) =>
    requireChannels({ provider: "nexus", channels }),
  );
  const iptvOrg = getChannelsByCountry(code, undefined, "default", 1).then((data) =>
    requireChannels({ provider: "iptv-org", channels: data.channels.slice(0, limit) }),
  );

  try {
    return await Promise.any([nexus, iptvOrg]);
  } catch {
    return { provider: "iptv-org", channels: [] };
  }
}

export async function getFastCategoryChannels(
  category: string,
  limit = 18,
  country?: string,
): Promise<ProviderResult> {
  const nexus = getNexusCategoryChannels(category, limit, country).then((channels) =>
    requireChannels({ provider: "nexus", channels }),
  );
  const iptvOrg = getChannelsByCategory(category, country, "default", 1).then((data) =>
    requireChannels({ provider: "iptv-org", channels: data.channels.slice(0, limit) }),
  );

  try {
    return await Promise.any([nexus, iptvOrg]);
  } catch {
    return { provider: "iptv-org", channels: [] };
  }
}
