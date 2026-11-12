"use client";

import * as m from "motion/react-m";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { readEffects, subscribeEffects } from "@/lib/effects";
import { prefersReducedMotion } from "@/lib/use-media";

type Phase = "idle" | "hidden" | "shown";

/**
 * Fades content in as it scrolls into view. Server HTML is always visible; only
 * blocks that start below the fold are hidden after hydration, and only with
 * full effects and motion allowed.
 */
export default function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || readEffects() !== "full" || prefersReducedMotion()) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
