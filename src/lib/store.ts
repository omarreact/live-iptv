import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel } from "@/lib/iptv/types";

type LibraryState = {
  saved: Channel[];
  recent: Channel[];
  toggleSaved: (channel: Channel) => void;
  isSaved: (id: string) => boolean;
  addRecent: (channel: Channel) => void;
  clearRecent: () => void;
};

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      saved: [],
      recent: [],
      toggleSaved: (channel) => {
        const exists = get().saved.some((c) => c.id === channel.id);
        set({
          saved: exists
            ? get().saved.filter((c) => c.id !== channel.id)
            : [channel, ...get().saved].slice(0, 200),
        });
      },
      isSaved: (id) => get().saved.some((c) => c.id === id),
      addRecent: (channel) => {
        set({
          recent: [channel, ...get().recent.filter((c) => c.id !== channel.id)].slice(0, 24),
        });
      },
      clearRecent: () => set({ recent: [] }),
    }),
    { name: "aether-library" },
  ),
);
