"use client";

import { useEffect, useRef } from "react";
import { readEffects, subscribeEffects } from "@/lib/effects";

/** How much of the video must be on screen before it plays. */
const IN_VIEW = 0.35;

function stillOnly(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || readEffects() === "calm";
}

/**
 * A product's looping demo: muted, inline, nothing downloaded until it first
 * comes into view (preload="none" with a poster). It plays only while on
 * screen and pauses when it leaves. Under reduced motion or calm effects it
 * never plays, so the poster is all that shows.
 */
export default function DemoPlayer({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    // React does not always reflect `muted` into the server HTML; muted is
    // what lets the browser play it without a gesture.
    video.muted = true;
    let inView = false;

    const sync = () => {
      if (inView && !stillOnly()) {
        video.play().catch(() => {
          // Autoplay refused (rare for muted video): the poster stays.
        });
      } else if (!video.paused) {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: IN_VIEW },
    );
    observer.observe(video);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", sync);
    const unsubscribe = subscribeEffects(sync);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      unsubscribe();
      video.pause();
    };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      preload="none"
      muted
      loop
      playsInline
      disablePictureInPicture
      aria-label={label}
      data-demo-video=""
    >
      <source src={src} type="video/webm" />
    </video>
  );
}
