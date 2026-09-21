"use client";

const DASH_JS_URL = "https://cdn.dashjs.org/v5.2.1/dash.all.min.js";

export type DashRepresentation = {
  id?: string | number;
  height?: number;
  bandwidth?: number;
  bitrateInKbit?: number;
};

export type DashPlayer = {
  initialize(
    video: HTMLVideoElement,
    source: string,
    autoPlay?: boolean,
  ): void;
  reset(): void;
  updateSettings(settings: Record<string, unknown>): void;
  getRepresentationsByType(type: "video"): DashRepresentation[];
  getCurrentRepresentationForType(type: "video"): DashRepresentation | null;
  setRepresentationForTypeById(
    type: "video",
    id: string | number,
    forceReplace?: boolean,
  ): void;
  on(event: string, listener: (event?: unknown) => void): void;
};

type DashMediaPlayerFactory = {
  (): { create(): DashPlayer };
  events: {
    STREAM_INITIALIZED: string;
    ERROR: string;
    QUALITY_CHANGE_RENDERED: string;
  };
};

export type DashGlobal = {
  MediaPlayer: DashMediaPlayerFactory;
};

declare global {
  interface Window {
    dashjs?: DashGlobal;
  }
}

let loader: Promise<DashGlobal> | null = null;

export function loadDashJs(): Promise<DashGlobal> {
  if (window.dashjs) return Promise.resolve(window.dashjs);
  if (loader) return loader;

  loader = new Promise<DashGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${DASH_JS_URL}"]`,
    );

    const resolveGlobal = () => {
      if (window.dashjs) {
        resolve(window.dashjs);
      } else {
        reject(new Error("dash.js loaded without exposing the player API"));
      }
    };

    if (existing) {
      existing.addEventListener("load", resolveGlobal, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load dash.js")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = DASH_JS_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", resolveGlobal, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load dash.js")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    loader = null;
    throw error;
  });

  return loader;
}
