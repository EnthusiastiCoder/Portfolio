/**
 * Matrix design tokens. Every text colour passes WCAG AA (4.5:1) on both
 * `background` and `surface`; `accentDim` and `rainHead` are decorative only.
 */
export const matrixTheme = {
  colors: {
    background: "#0D0208",
    surface: "#06110A",
    text: "#D1FFD6",
    textMuted: "#7BE495",
    accent: "#00FF41",
    link: "#00FF41",
    focus: "#00FF41",
    accentDim: "#008F11",
    rainHead: "#E6FFE9",
  },
  rain: {
    /** Upper frame-rate cap; the adaptive budget may lower it. */
    fps: 24,
    /** Glyph size in CSS pixels; one column per `fontSize` px at density 1. */
    fontSize: 16,
    /** Default devicePixelRatio cap. */
    maxDpr: 1,
    /** Half-width katakana, digits and a few symbols. */
    glyphs: 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789Z:・."=*+-<>¦|',
    /** System CJK-capable monospace stack; no web font is downloaded for the canvas. */
    fontFamily: '"MS Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans Mono CJK JP", monospace',
  },
} as const;

export type MatrixTheme = typeof matrixTheme;
