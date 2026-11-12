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

/**
 * A real heading whose text never changes. A short glyph "decode" plays on an
 * opaque aria-hidden overlay on first scroll-in, on hover, and when the red
 * pill is taken. Off in calm and under reduced motion.
 */
export default function DecodeHeading({
  as: Tag = "h2",
  id,
  className,
  children,
  suffix,
}: DecodeHeadingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const overlayRef = useRef<HTMLSpanElement>(null);
