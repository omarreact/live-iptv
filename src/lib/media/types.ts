export type MediaSourceSummary = {
  id: string;
  name: string;
  description: string;
};

export type MediaItem = {
  id: string;
  type: "directory" | "video";
  name: string;
  path: string;
  extension: string | null;
  playable: boolean;
};

export type MediaBrowsePayload = {
  source: MediaSourceSummary;
  path: string;
  items: MediaItem[];
};

export type MediaResolvePayload = {
  source: Pick<MediaSourceSummary, "id" | "name">;
  title: string;
  path: string;
  kind: "hls" | "file";
  mimeType: string;
  directPlayable: boolean;
  url: string;
  transcodeUrl: string;
};
