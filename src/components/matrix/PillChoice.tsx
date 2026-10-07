"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  isPillChosen,
  readPill,
  subscribePill,
  switchPill,
  writePill,
  type Pill,
} from "@/lib/pill";

const ANNOUNCEMENTS: Record<"red" | "blue", string> = {
  red: "Red pill taken: depth mode. Engineering, architecture and trade-offs first.",
  blue: "Blue pill taken: surface mode. Visuals first, kept short.",
};

const IMPLICIT_BOTH = "You took both pills: depth and surface, blended.";

/** "red|1" style snapshot: a primitive, so useSyncExternalStore sees stable values. */
function snapshot(): string {
  return `${readPill() ?? ""}|${isPillChosen() ? "1" : "0"}`;
}

const PILL_BUTTONS = [
  { pill: "red", label: "Red pill", hint: "depth: engineering and trade-offs" },
  { pill: "blue", label: "Blue pill", hint: "surface: visuals, kept short" },
] as const;

/**
 * The scene's choice: two native toggle buttons. Red switches to depth mode,
 * blue to surface mode, through the glitch transition. Scrolling the scene
 * (`#top`) fully out of view without a choice gives "both", announced once and
 * not persisted. No auto-scroll and no focus move after a choice.
 */
export default function PillChoice() {
  const state = useSyncExternalStore(subscribePill, snapshot, () => "|0");
  const [pill, chosenFlag] = state.split("|") as [Pill | "", string];
  const chosen = chosenFlag === "1";
  const [announcement, setAnnouncement] = useState("");
  const implicitDone = useRef(false);

  useEffect(() => {
    const scene = document.getElementById("top");
    if (!scene || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
        if (!scrolledPast || implicitDone.current || isPillChosen()) continue;
        implicitDone.current = true;
        writePill("both", { persist: false, updateUrl: false });
        setAnnouncement(IMPLICIT_BOTH);
        observer.disconnect();
      }
    });
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  function choose(next: "red" | "blue") {
    switchPill(next);
    setAnnouncement(ANNOUNCEMENTS[next]);
  }

  return (
    <div className="pill-choice">
      <div role="group" aria-label="Choose a pill" className="pill-hands">
        {PILL_BUTTONS.map((b) => (
          <button
            key={b.pill}
            type="button"
            aria-pressed={chosen && pill === b.pill}
            onClick={() => choose(b.pill)}
            className={`pill-btn pill-btn--${b.pill}`}
          >
            <span aria-hidden="true" className="pill-capsule pill-float" />
            <span className="pill-btn-text">
              <span className="pill-btn-label">{b.label}</span>
              <span className="pill-btn-hint">{b.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <p aria-live="polite" className="pill-status">
        {announcement}
      </p>
    </div>
  );
}
