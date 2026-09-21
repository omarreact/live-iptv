export type PlaybackProtocol = "mp4" | "hls" | "dash";

export type PlaybackSource = {
  url: string;
  protocol: PlaybackProtocol;
  quality?: string;
  mimeType?: string;
  headers?: Record<string, string>;
};

export type PlaybackSubtitle = {
  label: string;
  language: string;
  url: string;
};

export type PlaybackResult = {
  title?: string;
  sources: PlaybackSource[];
  subtitles: PlaybackSubtitle[];
};

export type BrowserPlaybackSource = Omit<PlaybackSource, "headers">;

export type BrowserPlaybackResult = {
  title?: string;
  sources: BrowserPlaybackSource[];
  subtitles: PlaybackSubtitle[];
};
