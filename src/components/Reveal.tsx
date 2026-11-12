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

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const frame = requestAnimationFrame(() => {
      setPhase("hidden");
      observer.observe(el);
    });
    // Choosing calm shows everything at once.
    const unsubscribe = subscribeEffects(() => {
      if (readEffects() === "calm") {
        setPhase("shown");
        observer.disconnect();
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribe();
    };
  }, []);

  return (
    <m.div
      ref={ref}
      className={className}
      initial={false}
      animate={phase === "hidden" ? { opacity: 0, y: 24 } : { opacity: 1, y: 0 }}
      transition={phase === "hidden" ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}
