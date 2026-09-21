"use client";

import { useEffect, type RefObject } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'input, textarea, select, button, a, [contenteditable="true"]',
      ),
    )
  );
}

export function usePlayerShortcuts({
  videoRef,
  onToggleFullscreen,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  onToggleFullscreen: () => void | Promise<void>;
}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const video = videoRef.current;
      if (!video) return;

      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          if (video.paused) {
            void video.play().catch(() => undefined);
          } else {
            video.pause();
          }
          break;

        case "arrowleft":
          event.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;

        case "arrowright":
          event.preventDefault();
          video.currentTime = Math.min(
            Number.isFinite(video.duration)
              ? video.duration
              : video.currentTime + 10,
            video.currentTime + 10,
          );
          break;

        case "arrowup":
          event.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;

        case "arrowdown":
          event.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;

        case "f":
          event.preventDefault();
          void onToggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggleFullscreen, videoRef]);
}
