"use client";

import { useSyncExternalStore } from "react";
import type { ChannelPreview } from "@/lib/iptv/types";

type LibraryState = {
  saved: ChannelPreview[];
  recent: ChannelPreview[];
  toggleSaved: (channel: ChannelPreview) => void;
  isSaved: (id: string) => boolean;
  addRecent: (channel: ChannelPreview) => void;
  clearRecent: () => void;
};

const STORAGE_KEY = "pinflix-library";
const listeners = new Set<() => void>();
let hydrated = false;

function isChannelPreview(value: unknown): value is ChannelPreview {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.shortName === "string" &&
    typeof item.logo === "string" &&
    Array.isArray(item.groups) &&
    item.groups.every((group) => typeof group === "string") &&
    (typeof item.country === "string" || item.country === null) &&
    (typeof item.quality === "string" || item.quality === null) &&
    typeof item.geoBlocked === "boolean" &&
    typeof item.available === "boolean"
  );
}

function readStoredList(value: unknown): ChannelPreview[] {
  return Array.isArray(value) ? value.filter(isChannelPreview) : [];
}

function persist(next: LibraryState): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        saved: next.saved,
        recent: next.recent,
      }),
    );
  } catch {
    // Storage can be unavailable in private browsing or locked-down contexts.
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function update(patch: Pick<LibraryState, "saved" | "recent">): void {
  state = {
    ...state,
    ...patch,
  };
  persist(state);
  notify();
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return;

    const record = parsed as Record<string, unknown>;
    state = {
      ...state,
      saved: readStoredList(record.saved),
      recent: readStoredList(record.recent),
    };
  } catch {
    // Ignore malformed or unavailable storage and keep the empty library.
  }
}

const actions = {
  toggleSaved(channel: ChannelPreview): void {
    hydrate();
    const exists = state.saved.some((item) => item.id === channel.id);
    update({
      saved: exists
        ? state.saved.filter((item) => item.id !== channel.id)
        : [channel, ...state.saved].slice(0, 200),
      recent: state.recent,
    });
  },

  isSaved(id: string): boolean {
    hydrate();
    return state.saved.some((item) => item.id === id);
  },

  addRecent(channel: ChannelPreview): void {
    hydrate();
    update({
      saved: state.saved,
      recent: [
        channel,
        ...state.recent.filter((item) => item.id !== channel.id),
      ].slice(0, 24),
    });
  },

  clearRecent(): void {
    hydrate();
    update({
      saved: state.saved,
      recent: [],
    });
  },
};

const serverState: LibraryState = {
  saved: [],
  recent: [],
  ...actions,
};

let state: LibraryState = serverState;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  hydrate();
  return () => listeners.delete(listener);
}

export function useLibrary<T>(selector: (current: LibraryState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(serverState),
  );
}
