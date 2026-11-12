"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { EFFECTS_EVENT, readEffects } from "@/lib/effects";
import { prefersReducedMotion } from "@/lib/use-media";

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/";
const DURATION_MS = 560;
const TICK_MS = 40;
