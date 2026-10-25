/**
 * Matrix design tokens. Every text colour passes WCAG AA (4.5:1) on both
 * `background` and `surface`; `accentDim` and `rainHead` are decorative only.
 */
export const matrixTheme = {
  colors: {
    /** Neutral near-black: no red tint under the green mode or the rain. */
    background: "#050806",
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
    /** Binary only: the rain draws just 0 and 1. */
    glyphs: "01",
    /** Monospace stack; no web font is downloaded for the canvas. */
    fontFamily: 'ui-monospace, Menlo, Consolas, "Courier New", monospace',
  },
} as const;

export type MatrixTheme = typeof matrixTheme;

/**
 * One pill mode's colours. Text tokens pass 4.5:1 on `background` and `surface`; `focus` 3:1.
 * A type alias, not an interface, so it stays assignable to Record<string, string>.
 */
export type PillPalette = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  link: string;
  focus: string;
};

/**
 * Pill mode palettes, mirrored as CSS variables under `html[data-pill=...]` in
 * globals.css. Red (depth) is near-white on a dark red-black with red-pill accents, blue
 * (surface) is a cool blue/cyan look, both is the classic matrix look.
 */
export const pillThemes: { red: PillPalette; blue: PillPalette; both: PillPalette } = {
  red: {
    background: "#0D0208",
    surface: "#14070B",
    text: "#F4ECED",
    textMuted: "#C9B4B7",
    accent: "#FF6B7A",
    link: "#FF8A96",
    focus: "#FF6B7A",
  },
  blue: {
    background: "#050B14",
    surface: "#0A1424",
    text: "#E6F1FF",
    textMuted: "#9FB8D6",
    accent: "#6CC4FF",
    link: "#8FD3FF",
    focus: "#6CC4FF",
  },
  both: {
    background: matrixTheme.colors.background,
    surface: matrixTheme.colors.surface,
    text: matrixTheme.colors.text,
    textMuted: matrixTheme.colors.textMuted,
    accent: matrixTheme.colors.accent,
    link: matrixTheme.colors.link,
    focus: matrixTheme.colors.focus,
  },
};
