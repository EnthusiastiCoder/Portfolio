"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  applyFluidMode,
  DEFAULT_FLUID_MODE,
  readFluidMode,
  subscribeFluidMode,
  writeFluidMode,
} from "@/lib/fluid/fluid-mode";

/**
 * Switches the fluid between showing only through the rain digits (pressed,
 * the default) and the full smoky dye. Persists like the sound toggle.
 */
export default function FluidModeToggle() {
  const mode = useSyncExternalStore(
    subscribeFluidMode,
    () => readFluidMode(),
    () => DEFAULT_FLUID_MODE,
  );
  const chars = mode === "chars";

  // The stored choice reaches <html> after hydration; the fluid itself loads later still.
  useEffect(() => {
    applyFluidMode(readFluidMode());
  }, []);

  const toggle = () => {
    const next = chars ? "smoke" : "chars";
    writeFluidMode(next);
    applyFluidMode(next);
  };

  return (
    <button
      type="button"
      className="sound-toggle fluid-mode-toggle"
      aria-pressed={chars}
      aria-label="Fluid through digits"
      title={chars ? "Fluid through the digits" : "Smoky fluid"}
      onClick={toggle}
      data-testid="fluid-mode-toggle"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {chars ? (
          <>
            {/* A zero and a one, drawn as shapes. */}
            <rect x="3.5" y="5" width="6" height="14" rx="3" />
            <path d="M14.5 8 17.5 5v14" />
            <path d="M14.5 19h6" />
          </>
        ) : (
          <>
            {/* Smoke: three drifting waves. */}
            <path d="M3 8c3-3 6 3 9 0s6-3 9 0" />
            <path d="M3 13c3-3 6 3 9 0s6-3 9 0" />
            <path d="M3 18c3-3 6 3 9 0s6-3 9 0" />
          </>
        )}
      </svg>
    </button>
  );
}
