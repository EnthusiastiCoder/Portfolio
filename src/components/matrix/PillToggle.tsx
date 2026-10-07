"use client";

import { useState, useSyncExternalStore } from "react";
import { readPill, subscribePill, switchPill, type Pill } from "@/lib/pill";

const OPTIONS: { pill: Pill; label: string }[] = [
  { pill: "red", label: "Red" },
  { pill: "blue", label: "Blue" },
  { pill: "both", label: "Both" },
];

const ANNOUNCEMENTS: Record<Pill, string> = {
  red: "Depth mode on.",
  blue: "Surface mode on.",
  both: "Both modes blended.",
};

const currentPill = (): Pill => readPill() ?? "both";

/**
 * Header pill mode switch on every page: a fieldset of three native radios
 * styled as small pills (Both is two fused half-pills). Selecting one runs the
 * same glitch switch as the scene pills and persists the choice.
 */
export default function PillToggle() {
  const pill = useSyncExternalStore(subscribePill, currentPill, () => "both" as Pill);
  const [announcement, setAnnouncement] = useState("");

  function select(next: Pill) {
    switchPill(next);
    setAnnouncement(ANNOUNCEMENTS[next]);
  }

  return (
    <fieldset className="pill-toggle">
      <legend className="sr-only">Pill mode</legend>
      {OPTIONS.map((o) => (
        <label key={o.pill} className={`pill-toggle-opt pill-toggle-opt--${o.pill}`}>
          <input
            type="radio"
            name="pill-mode"
            value={o.pill}
            checked={pill === o.pill}
            onChange={() => select(o.pill)}
            className="pill-toggle-input"
          />
          <span aria-hidden="true" className="pill-toggle-dot" />
          {o.label}
        </label>
      ))}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </fieldset>
  );
}
