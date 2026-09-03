"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-only user library.
 * Catalog lives on the server (RSC / provider).
 * We only persist canonical channel.id values so favorites stay small and stable.
 */
type UserState = {
  favorites: string[];
  recent: string[];
  toggleFavorite: (channelId: string) => void;
  isFavorite: (channelId: string) => boolean;
  addRecent: (channelId: string) => void;
  clearRecent: () => void;
  clearFavorites: () => void;
};

const MAX_FAVORITES = 200;
const MAX_RECENT = 24;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recent: [],

      toggleFavorite: (channelId) => {
        const exists = get().favorites.includes(channelId);
        set({
          favorites: exists
            ? get().favorites.filter((id) => id !== channelId)
            : [channelId, ...get().favorites].slice(0, MAX_FAVORITES),
        });
      },

      isFavorite: (channelId) => get().favorites.includes(channelId),

      addRecent: (channelId) => {
        set({
          recent: [channelId, ...get().recent.filter((id) => id !== channelId)].slice(
            0,
            MAX_RECENT,
          ),
        });
      },

      clearRecent: () => set({ recent: [] }),
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: "aether-user",
      // Only persist ids — never full channel objects
      partialize: (state) => ({
        favorites: state.favorites,
        recent: state.recent,
      }),
    },
  ),
);
