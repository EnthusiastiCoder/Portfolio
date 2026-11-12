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
