import { describe, it, expect } from "vitest";
import { matrixTheme } from "@/config/theme";

// WCAG 2.x relative luminance and contrast ratio, computed here so the test
// does not trust any helper in src/.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
