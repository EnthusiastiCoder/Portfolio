"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { EFFECTS_EVENT, readEffects } from "@/lib/effects";
import { prefersReducedMotion } from "@/lib/use-media";

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/";
const DURATION_MS = 560;
const TICK_MS = 40;

interface DecodeHeadingProps {
  as?: "h2" | "h3";
  id?: string;
  className?: string;
  children: string;
  /** Optional trailing content inside the heading (not scrambled). */
  suffix?: ReactNode;
}
