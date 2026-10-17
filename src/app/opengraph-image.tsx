import { ImageResponse } from "next/og";
import { matrixTheme } from "@/config/theme";
import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name}: software engineer portfolio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Latin and digits only: the bundled OG font has no katakana.
const STRIP = "0 1 Z : 7 = 3 * 9 + 4 < > 2 | 8 . 5 - 6";

export default function OpengraphImage() {
  const { colors } = matrixTheme;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#000000",
        color: colors.text,
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: colors.textMuted }}>&gt; whoami</div>
      <div
        style={{
          display: "flex",
          marginTop: 16,
          fontSize: 96,
          fontWeight: 700,
          color: colors.accent,
        }}
      >
        {siteConfig.name}
      </div>
      <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: colors.text }}>
        Software Engineer · Products
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 64,
          fontSize: 28,
          letterSpacing: 6,
          color: colors.accentDim,
        }}
      >
        {STRIP}
      </div>
    </div>,
    size,
  );
}
