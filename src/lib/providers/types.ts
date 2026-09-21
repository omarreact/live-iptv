import type { PlaybackResult } from "@/types/media";

export type ResolvePlaybackInput = {
  id: string;
  slug?: string;
  season?: number;
  episode?: number;
};

export interface PlaybackProvider {
  id: string;
  resolve(input: ResolvePlaybackInput): Promise<PlaybackResult>;
}
