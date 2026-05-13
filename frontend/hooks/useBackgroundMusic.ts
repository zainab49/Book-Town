"use client";
import { useEffect } from "react";

// Module-level registry keeps the same Audio element alive across page transitions
// that share the same src (e.g. login ↔ register).
type Entry = {
  audio: HTMLAudioElement;
  consumers: number;
  fadeInterval: ReturnType<typeof setInterval> | null;
  baseVolume: number;
};
const registry = new Map<string, Entry>();

const FADE_DURATION_MS = 600;
const FADE_STEPS = 24;

export function useBackgroundMusic(src: string, volume = 0.4) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let entry = registry.get(src);
    if (!entry) {
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = volume;
      entry = { audio, consumers: 0, fadeInterval: null, baseVolume: volume };
      registry.set(src, entry);

      audio.play().catch(() => {
        const resume = () => { audio.play().catch(() => {}); };
        document.addEventListener("click", resume, { once: true });
        document.addEventListener("keydown", resume, { once: true });
      });
    } else {
      // New consumer arrived — cancel any in-progress fade and restore volume
      if (entry.fadeInterval !== null) {
        clearInterval(entry.fadeInterval);
        entry.fadeInterval = null;
        entry.audio.volume = entry.baseVolume;
      }
    }
    entry.consumers++;

    return () => {
      const e = registry.get(src);
      if (!e) return;
      e.consumers--;
      if (e.consumers > 0) return;

      // Fade out, then pause and clean up
      const startVolume = e.audio.volume;
      const stepTime = FADE_DURATION_MS / FADE_STEPS;
      let step = 0;

      e.fadeInterval = setInterval(() => {
        const current = registry.get(src);
        // Abort if a new consumer mounted during the fade
        if (!current || current.consumers > 0) return;

        step++;
        current.audio.volume = Math.max(0, startVolume * (1 - step / FADE_STEPS));

        if (step >= FADE_STEPS) {
          clearInterval(current.fadeInterval!);
          current.fadeInterval = null;
          current.audio.pause();
          current.audio.volume = current.baseVolume;
          current.audio.src = "";
          registry.delete(src);
        }
      }, stepTime);
    };
  }, [src, volume]);
}
