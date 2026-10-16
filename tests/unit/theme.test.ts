import { describe, it, expect } from "vitest";
import { matrixTheme } from "@/config/theme";

// WCAG 2.x relative luminance and contrast ratio, computed here so the test
// does not trust any helper in src/.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
