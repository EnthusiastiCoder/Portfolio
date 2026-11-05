"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { readSoundPref, writeSoundPref } from "@/lib/audio/sound-pref";
import type { AudioEngine } from "@/lib/audio/engine";

/**
 * Opt-in sound. Off by default; the Web Audio engine is fetched only when the
 * visitor turns sound on (or, with sound left on from a past visit, on the
 * first click or key press, since browsers need a gesture to start audio).
 */
const SOUND_EVENT = "portfolio-sound";
const subscribe = (cb: () => void) => {
  window.addEventListener(SOUND_EVENT, cb);
  return () => window.removeEventListener(SOUND_EVENT, cb);
};

export default function SoundToggle() {
  // Server and first paint say off; the stored choice applies after hydration.
  const on = useSyncExternalStore(
    subscribe,
    () => readSoundPref(),
    () => false,
  );
  const engine = useRef<Promise<AudioEngine> | null>(null);

  const load = () => {
    engine.current ??= import("@/lib/audio/engine").then((m) => m.createAudioEngine());
    return engine.current;
  };

  useEffect(() => {
    if (!readSoundPref()) return;
    const start = () => {
      void load().then((e) => e.setEnabled(true));
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);

  useEffect(
    () => () => {
      void engine.current?.then((e) => e.destroy());
    },
    [],
  );

  const toggle = () => {
    const next = !on;
    writeSoundPref(next);
    window.dispatchEvent(new Event(SOUND_EVENT));
    if (next) void load().then((e) => e.setEnabled(true));
    else void engine.current?.then((e) => e.setEnabled(false));
  };

  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={on}
      aria-label="Sound"
      title={on ? "Sound on" : "Sound off"}
      onClick={toggle}
      data-testid="sound-toggle"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 5a10 10 0 0 1 0 14" />
          </>
        ) : (
          <>
            <path d="m17 9 6 6" />
            <path d="m23 9-6 6" />
          </>
        )}
      </svg>
    </button>
  );
}
