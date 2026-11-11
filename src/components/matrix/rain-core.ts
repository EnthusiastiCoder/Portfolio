/**
 * Pure digital-rain drawing step, shared by the OffscreenCanvas worker and the
 * main-thread fallback. No DOM access: it only needs a 2D context.
 */

export type Rain2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface RainPalette {
  background: string;
  accent: string;
  accentDim: string;
  rainHead: string;
}

export interface RainStyle {
  glyphs: string;
  fontSize: number;
  fontFamily: string;
  colors: RainPalette;
}

export interface RainState {
  /** CSS-pixel size of the drawing area. */
  width: number;
  height: number;
  /** Horizontal distance between columns, in CSS pixels. */
  step: number;
  rows: number;
  /** Current head row per column (fractional). */
  drops: Float32Array;
  /** Rows advanced per frame per column. */
  speeds: Float32Array;
  /** Last row drawn per column, so its glyph can be repainted as trail. */
  lastRow: Int32Array;
  /** Glyph index drawn at `lastRow`, reused for the trail repaint. */
  lastGlyph: Int32Array;
  random: () => number;
}

/** Small deterministic PRNG (mulberry32), so static frames are identical every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Number of columns for a width: about one per `fontSize` px at density 1. */
export function columnCount(width: number, fontSize: number, density: number): number {
  return Math.max(1, Math.floor((width / fontSize) * density));
}

export function createRainState(
  width: number,
  height: number,
  fontSize: number,
  density: number,
  random: () => number = Math.random,
): RainState {
  const cols = columnCount(width, fontSize, density);
  const rows = Math.max(1, Math.ceil(height / fontSize));
  const drops = new Float32Array(cols);
  const speeds = new Float32Array(cols);
  const lastRow = new Int32Array(cols).fill(-1);
  const lastGlyph = new Int32Array(cols);
  for (let i = 0; i < cols; i++) {
    // Start above the top edge at staggered heights so columns do not fall in step.
    drops[i] = -Math.floor(random() * rows);
    speeds[i] = 0.55 + random() * 0.5;
  }
  return { width, height, step: width / cols, rows, drops, speeds, lastRow, lastGlyph, random };
}

function font(style: RainStyle): string {
  return `${style.fontSize}px ${style.fontFamily}`;
}

/** Advances every column by one frame and paints it. Cost: one fill plus two glyphs per column. */
export function stepRain(ctx: Rain2D, state: RainState, style: RainStyle): void {
  const { colors, glyphs, fontSize } = style;
  const { drops, speeds, lastRow, lastGlyph, step, rows, random } = state;
  const cols = drops.length;
  const glyphCount = glyphs.length;

  // Fade the previous frame towards the background to leave a trail.
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.globalAlpha = 1;
  ctx.font = font(style);
  ctx.textBaseline = "top";

  // Repaint last frame's heads in the trail colour.
  ctx.fillStyle = colors.accent;
  for (let i = 0; i < cols; i++) {
    const row = lastRow[i];
    if (row >= 0) ctx.fillText(glyphs[lastGlyph[i]], i * step, row * fontSize);
  }

  // Draw the new heads.
  ctx.fillStyle = colors.rainHead;
  for (let i = 0; i < cols; i++) {
    drops[i] += speeds[i];
    const row = Math.floor(drops[i]);
    if (row > rows) {
      lastRow[i] = -1;
      if (random() < 0.04) drops[i] = -Math.floor(random() * 8);
      continue;
    }
    if (row < 0 || row === lastRow[i]) continue;
    const glyph = Math.floor(random() * glyphCount);
    ctx.fillText(glyphs[glyph], i * step, row * fontSize);
    lastRow[i] = row;
    lastGlyph[i] = glyph;
  }
}

/** Paints one still, dim glyph field. Deterministic for a given size and density. */
export function drawStaticFrame(
  ctx: Rain2D,
  width: number,
  height: number,
  density: number,
  style: RainStyle,
): void {
  const { colors, glyphs, fontSize } = style;
  const random = seededRandom(0x5eed);
  const cols = columnCount(width, fontSize, density);
  const rows = Math.max(1, Math.ceil(height / fontSize));
  const step = width / cols;

  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  ctx.font = font(style);
  ctx.textBaseline = "top";

  for (let i = 0; i < cols; i++) {
    const head = Math.floor(random() * (rows + 6));
    const length = 4 + Math.floor(random() * 14);
    for (let k = length; k >= 0; k--) {
      const row = head - k;
      if (row < 0 || row > rows) continue;
      const glyph = glyphs[Math.floor(random() * glyphs.length)];
      ctx.fillStyle = k === 0 ? colors.rainHead : colors.accentDim;
      ctx.globalAlpha = k === 0 ? 0.55 : 0.45 * (1 - k / (length + 1));
      ctx.fillText(glyph, i * step, row * fontSize);
    }
  }
  ctx.globalAlpha = 1;
}

export interface RainBudgetLike {
  fps: number;
  density: number;
}

export interface RainFrameConfig {
  /** CSS-pixel size of the canvas. */
  width: number;
  height: number;
  /** Device pixel ratio already capped by the budget. */
  dpr: number;
  budget: RainBudgetLike;
}

/** Schedules the next frame: rAF where available, else a timer at the frame interval. */
export interface RainScheduler {
  request(callback: (now: number) => void, intervalMs: number): number;
  cancel(handle: number): void;
}

export interface RainSurface {
  width: number;
  height: number;
}

export interface RainRenderer {
  configure(config: RainFrameConfig): void;
  pause(): void;
  resume(): void;
  /** Frames painted since creation (for manual frame-rate checks). */
  frames(): number;
  destroy(): void;
}

/**
 * Drives the rain on any canvas-like surface: sizes the backing store, draws the
 * static frame when fps is 0, and otherwise steps at most `fps` times a second.
 */
export function createRainRenderer(
  surface: RainSurface,
  ctx: Rain2D,
  style: RainStyle,
  scheduler: RainScheduler,
): RainRenderer {
  let config: RainFrameConfig | null = null;
  let state: RainState | null = null;
  let paused = true;
  let handle: number | null = null;
  let last = 0;
  let painted = 0;

  const interval = () => (config && config.budget.fps > 0 ? 1000 / config.budget.fps : 0);
  const animated = () => config !== null && config.budget.fps > 0;

  function stop() {
    if (handle !== null) scheduler.cancel(handle);
    handle = null;
  }

  function tick(now: number) {
    handle = null;
    if (paused || !animated() || !state) return;
    // Allow 1 ms of jitter so a 30 fps cap on a 60 Hz display does not drop to 20.
    if (now - last >= interval() - 1) {
      last = now;
      stepRain(ctx, state, style);
      painted++;
    }
    handle = scheduler.request(tick, interval());
  }

  function start() {
    if (handle === null && !paused && animated()) handle = scheduler.request(tick, interval());
  }
