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

  useEffect(() => {
    const heading = headingRef.current;
    const overlay = overlayRef.current;
    if (!heading || !overlay) return;
    const text = children;
    let timer: ReturnType<typeof setInterval> | undefined;
    let inView = false;

    const stop = () => {
      clearInterval(timer);
      timer = undefined;
      overlay.hidden = true;
      overlay.textContent = "";
    };

    const play = () => {
      if (timer !== undefined || readEffects() !== "full" || prefersReducedMotion()) return;
      const started = performance.now();
      overlay.hidden = false;
      const frame = () => {
        const progress = (performance.now() - started) / DURATION_MS;
        if (progress >= 1) {
          stop();
          return;
        }
        const revealed = Math.floor(progress * text.length);
        let out = "";
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          out +=
            i < revealed || ch === " " ? ch : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
        }
        overlay.textContent = out;
      };
      frame();
      timer = setInterval(frame, TICK_MS);
    };

    // First reveal: only for headings that start below the fold, so nothing moves at load.
    const startsBelowFold = heading.getBoundingClientRect().top >= window.innerHeight;
    let firstRevealDone = !startsBelowFold;
    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      if (inView && !firstRevealDone) {
        firstRevealDone = true;
        play();
      }
    });
    observer.observe(heading);
