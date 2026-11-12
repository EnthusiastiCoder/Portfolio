import { ImageResponse } from "next/og";
import { matrixTheme } from "@/config/theme";
import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name}: software engineer portfolio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
