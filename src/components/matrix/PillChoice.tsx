"use client";

import { useState, useSyncExternalStore } from "react";
import { readEffects, subscribeEffects, writeEffects, type EffectsLevel } from "@/lib/effects";

const ANNOUNCEMENTS: Record<EffectsLevel, string> = {
  full: "Red pill taken: full effects. The rain moves and headings decode.",
  calm: "Blue pill taken: calm mode. The rain is still and effects are off.",
};
