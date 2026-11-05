import type { Pill } from "@/lib/pill";
import type { RGB } from "./fluid-sim";

/**
 * Dye palettes per mode: red is red dye, blue is blue/cyan, and "both" (the
 * green personality mode a visitor gets by taking no pill) is Matrix green, so
 * the rain digits stay green. Values are linear RGB before the per-splat
 * intensity scale.
 */
export const FLUID_PALETTES: Record<Pill, readonly RGB[]> = {
  red: [
    [1, 0.05, 0.08],
    [0.95, 0.12, 0.02],
    [0.85, 0.0, 0.25],
  ],
  blue: [
    [0.05, 0.35, 1],
    [0.0, 0.85, 1],
    [0.2, 0.15, 1],
  ],
  both: [
    [0.0, 1, 0.35],
    [0.1, 0.85, 0.15],
    [0.45, 1, 0.1],
    [0.0, 0.7, 0.45],
  ],
};

/** Dye strength per splat; low because splats pile up while the pointer moves. */
export const SPLAT_INTENSITY = 0.12;

/** A palette colour scaled to splat strength. `rand` is injectable for tests. */
export function pickDye(
  pill: Pill,
  rand: () => number = Math.random,
  intensity = SPLAT_INTENSITY,
): RGB {
  const list = FLUID_PALETTES[pill];
  const c = list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  return [c[0] * intensity, c[1] * intensity, c[2] * intensity];
}

/** CSS gradient for the static fallback (no WebGL): the same palette, frozen. */
export function staticGradient(pill: Pill): string {
  const css = (c: RGB, a: number) =>
    `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)} / ${a})`;
  const p = FLUID_PALETTES[pill];
  const a = p[0];
  const b = p[1 % p.length];
  return [
    `radial-gradient(ellipse 55% 45% at 22% 30%, ${css(a, 0.32)}, transparent 70%)`,
    `radial-gradient(ellipse 50% 50% at 78% 70%, ${css(b, 0.28)}, transparent 70%)`,
  ].join(", ");
}
