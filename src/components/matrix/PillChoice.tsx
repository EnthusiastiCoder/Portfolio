"use client";

import { useState, useSyncExternalStore } from "react";
import { readEffects, subscribeEffects, writeEffects, type EffectsLevel } from "@/lib/effects";

const ANNOUNCEMENTS: Record<EffectsLevel, string> = {
  full: "Red pill taken: full effects. The rain moves and headings decode.",
  calm: "Blue pill taken: calm mode. The rain is still and effects are off.",
};

const GLITCH_MS = 520;

/**
 * Morpheus' choice as two toggle buttons. Red turns full effects on, blue
 * switches to calm. Content is never gated: this only changes the effects level.
 */
export default function PillChoice() {
  const level = useSyncExternalStore(subscribeEffects, readEffects, () => null);
  const [announcement, setAnnouncement] = useState("");

  function choose(next: EffectsLevel) {
    writeEffects(next);
    setAnnouncement(ANNOUNCEMENTS[next]);
    if (next === "full") {
      // Replay the hero glitch once as the "reveal".
      const name = document.getElementById("hero-name");
      if (name) {
        name.dataset.glitch = "on";
        window.setTimeout(() => delete name.dataset.glitch, GLITCH_MS);
      }
    }
  }

  return (
    <div className="mt-8">
      <p id="pill-label" className="text-muted text-sm">
        Choose your reality:
      </p>
      <div role="group" aria-labelledby="pill-label" className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          aria-pressed={level === "full"}
          onClick={() => choose("full")}
          className="border-pill-red/60 text-pill-red aria-pressed:border-pill-red inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-shadow hover:shadow-[0_0_14px_rgb(255_107_122/0.3)] aria-pressed:shadow-[0_0_0_1px_var(--color-pill-red),0_0_16px_rgb(255_107_122/0.35)]"
        >
          <span
            aria-hidden="true"
            className="bg-pill-red inline-block h-3 w-6 rounded-full shadow-[0_0_10px_rgb(255_107_122/0.6)]"
          />
          <span aria-hidden="true">{level === "full" ? "[x]" : "[ ]"}</span>
          Red pill <span className="text-ink font-normal">· full effects</span>
        </button>
        <button
          type="button"
          aria-pressed={level === "calm"}
          onClick={() => choose("calm")}
          className="border-pill-blue/60 text-pill-blue aria-pressed:border-pill-blue inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-shadow hover:shadow-[0_0_14px_rgb(108_196_255/0.3)] aria-pressed:shadow-[0_0_0_1px_var(--color-pill-blue),0_0_16px_rgb(108_196_255/0.35)]"
        >
          <span
            aria-hidden="true"
            className="bg-pill-blue inline-block h-3 w-6 rounded-full shadow-[0_0_10px_rgb(108_196_255/0.6)]"
          />
          <span aria-hidden="true">{level === "calm" ? "[x]" : "[ ]"}</span>
          Blue pill <span className="text-ink font-normal">· calm</span>
        </button>
      </div>
      <p aria-live="polite" className="text-muted mt-3 min-h-5 text-xs">
        {announcement}
      </p>
    </div>
  );
}
