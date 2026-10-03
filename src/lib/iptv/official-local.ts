export type OfficialLocalChannel = {
  id: string;
  name: string;
  country: string;
  category: string;
  videoId: string;
  sourceLabel: string;
};

const OFFICIAL_LOCAL_CHANNELS: OfficialLocalChannel[] = [
  {
    id: "somoy-tv",
    name: "Somoy TV",
    country: "BD",
    category: "News",
    videoId: "T-l3aiJd3pI",
    sourceLabel: "Official YouTube",
  },
  {
    id: "channel-24",
    name: "Channel 24",
    country: "BD",
    category: "News",
    videoId: "6CydCnB1ZDY",
    sourceLabel: "Official YouTube",
  },
  {
    id: "jamuna-tv",
    name: "Jamuna TV",
    country: "BD",
    category: "News",
    videoId: "V010trip4JY",
    sourceLabel: "Official YouTube",
  },
  {
    id: "ekattor-tv",
    name: "Ekattor TV",
    country: "BD",
    category: "News",
    videoId: "iRht6bcuns4",
    sourceLabel: "Official YouTube",
  },
];

export function getOfficialLocalChannels(countryCode: string): OfficialLocalChannel[] {
  const country = countryCode.trim().toUpperCase();
  return OFFICIAL_LOCAL_CHANNELS.filter((channel) => channel.country === country);
}

export function getOfficialLocalChannel(channelId: string): OfficialLocalChannel | null {
  return OFFICIAL_LOCAL_CHANNELS.find((channel) => channel.id === channelId) || null;
}
