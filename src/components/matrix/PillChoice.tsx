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
  red: "Red pill taken: my skills and the impact I measured, first.",
  blue: "Blue pill taken: surface mode. Visuals first, kept short.",
};

const IMPLICIT_BOTH = "No pill taken, so you get me: the music, the chess and the games.";

/** How long a tap keeps the pill's message up on touch screens. */
const TAP_SAY_MS = 2600;

/** "red|1" style snapshot: a primitive, so useSyncExternalStore sees stable values. */
function snapshot(): string {
  return `${readPill() ?? ""}|${isPillChosen() ? "1" : "0"}`;
}

const PILL_BUTTONS = [
  {
    pill: "red",
    label: "Red pill: go deep into the engineering",
    says: "Take the red pill and I'll show you how deep the engineering goes: the architecture, the trade-offs and the numbers behind each build.",
  },
  {
    pill: "blue",
    label: "Blue pill: stay on the surface",
    says: "Take the blue pill and I'll keep it on the surface: the products, the design and the people they help.",
  },
] as const;

/** The figure itself (face and torso): the way into the green "meet me" mode. */
const ME_BUTTON = {
  label: "Meet me (no pill)",
  says: "Skip the pills and just meet me: the music, the chess and the games behind the code.",
  announce: "No pill: you get me, the music, the chess and the games.",
} as const;

/**
 * The scene's choice: the two pills in the portrait's palms are the controls.
 * Each is a transparent native toggle button over its pill, placed from the
 * `--red-x/y` and `--blue-x/y` custom properties the 3D scene keeps in step
 * with the pills on screen (the poster's positions until then). Hover or focus
 * shows a speech bubble from the figure, which is also the button's
 * description; on touch, a tap picks the pill and shows its bubble briefly.
 * Red switches to skills and impact, blue to the products, through the glitch
 * transition. A third button over the figure's face and torso (it tracks the
 * `--me-x/y` the scene publishes, under the pills) picks the green "meet me"
 * mode the same way. Scrolling the scene (`#top`) fully out of view without a
 * choice gives "both", the green personality mode, announced once and not persisted.
 * No auto-scroll and no focus move after a choice.
 */
export default function PillChoice() {
  const state = useSyncExternalStore(subscribePill, snapshot, () => "|0");
  const [pill, chosenFlag] = state.split("|") as [Pill | "", string];
  const chosen = chosenFlag === "1";
  const [announcement, setAnnouncement] = useState("");
  const [tapped, setTapped] = useState<"red" | "blue" | "me" | null>(null);
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

  useEffect(() => {
    if (!tapped) return;
    const timer = setTimeout(() => setTapped(null), TAP_SAY_MS);
    return () => clearTimeout(timer);
  }, [tapped]);

  function choose(next: "red" | "blue") {
    switchPill(next);
    setAnnouncement(ANNOUNCEMENTS[next]);
  }

  function meetMe() {
    switchPill("both");
    setAnnouncement(ME_BUTTON.announce);
  }

  return (
    <div className="pill-choice">
      <div
        role="group"
        aria-label="Choose a pill"
        className="pill-hits"
        data-say={tapped ?? undefined}
      >
        {PILL_BUTTONS.map((b) => (
          <button
            key={b.pill}
            type="button"
            aria-label={b.label}
            aria-describedby={`pill-say-${b.pill}`}
            aria-pressed={chosen && pill === b.pill}
            onPointerUp={(e) => {
              if (e.pointerType === "touch") setTapped(b.pill);
            }}
            onClick={() => choose(b.pill)}
            className={`pill-hit pill-hit--${b.pill}`}
          />
        ))}
        <button
          type="button"
          aria-label={ME_BUTTON.label}
          aria-describedby="pill-say-me"
          aria-pressed={chosen && pill === "both"}
          onPointerUp={(e) => {
            if (e.pointerType === "touch") setTapped("me");
          }}
          onClick={meetMe}
          className="pill-hit pill-hit--me"
        />
        {PILL_BUTTONS.map((b) => (
          <div key={b.pill} className={`pill-say pill-say--${b.pill}`}>
            <p id={`pill-say-${b.pill}`} className="pill-say-card panel">
              {b.says}
            </p>
            <span className="pill-say-tail" aria-hidden="true" />
          </div>
        ))}
        <div className="pill-say pill-say--me">
          <p id="pill-say-me" className="pill-say-card panel">
            {ME_BUTTON.says}
          </p>
          <span className="pill-say-tail" aria-hidden="true" />
        </div>
      </div>
      <p aria-live="polite" className="pill-status">
        {announcement}
      </p>
    </div>
  );
}
