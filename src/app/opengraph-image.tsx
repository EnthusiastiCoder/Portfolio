import { ImageResponse } from "next/og";
import { matrixTheme } from "@/config/theme";
import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name}: software engineer portfolio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Latin and digits only: the bundled OG font has no katakana.
const STRIP = "0 1 Z : 7 = 3 * 9 + 4 < > 2 | 8 . 5 - 6";
