export type PlaybackProtocol = "mp4" | "hls" | "dash";

export type PlaybackSource = {
  url: string;
  protocol: PlaybackProtocol;
  quality?: string;
  mimeType?: string;

  /**
   * Server-only request headers for authorized upstreams.
   * Never serialize these values to the browser.
   */
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

  /**
   * Non-sensitive playback limitations that are safe to show in the UI.
   */
  warnings?: string[];
};
