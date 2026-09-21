import "server-only";

import { authorizedProvider } from "./authorized-provider.server";
import { legacyEntertainmentProvider } from "./legacy-entertainment-provider.server";
import type { PlaybackProvider } from "./types";

const providers = new Map<string, PlaybackProvider>([
  [legacyEntertainmentProvider.id, legacyEntertainmentProvider],
  [authorizedProvider.id, authorizedProvider],
]);

export function getPlaybackProvider(id: string): PlaybackProvider {
  const provider = providers.get(id);
  if (!provider) throw new Error(`Unknown playback provider: ${id}`);
  return provider;
}
