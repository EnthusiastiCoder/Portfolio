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
  /** Frames of pointer wake left per column: faster drop, bright trail. */
  boost: Float32Array;
  random: () => number;
}

/** Columns within this many CSS pixels of the pointer wake up. */
export const WAKE_RADIUS_PX = 80;
/** How many frames a woken column stays fast and bright. */
export const WAKE_FRAMES = 36;

/** Wakes the columns near x: they drop twice as fast and glow for a short while. */
export function wakeRain(state: RainState, x: number, radius: number = WAKE_RADIUS_PX): void {
  const { boost, step } = state;
  const first = Math.max(0, Math.floor((x - radius) / step));
  const last = Math.min(boost.length - 1, Math.ceil((x + radius) / step));
  for (let i = first; i <= last; i++) {
    const distance = Math.abs(i * step + step / 2 - x);
    if (distance > radius) continue;
    const frames = Math.round(WAKE_FRAMES * (1 - distance / (radius * 2)));
    if (frames > boost[i]) boost[i] = frames;
  }
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
  const boost = new Float32Array(cols);
  for (let i = 0; i < cols; i++) {
    // Start above the top edge at staggered heights so columns do not fall in step.
    drops[i] = -Math.floor(random() * rows);
    speeds[i] = 0.55 + random() * 0.5;
  }
  return {
    width,
    height,
    step: width / cols,
    rows,
    drops,
    speeds,
    lastRow,
    lastGlyph,
    boost,
    random,
  };
}

function font(style: RainStyle): string {
  return `${style.fontSize}px ${style.fontFamily}`;
}

/** Advances every column by one frame and paints it. Cost: one fill plus two glyphs per column. */
export function stepRain(ctx: Rain2D, state: RainState, style: RainStyle): void {
  const { colors, glyphs, fontSize } = style;
  const { drops, speeds, lastRow, lastGlyph, boost, step, rows, random } = state;
  const cols = drops.length;
  const glyphCount = glyphs.length;

  // Fade the previous frame towards the background to leave a trail.
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.globalAlpha = 1;
  ctx.font = font(style);
  ctx.textBaseline = "top";

  // Repaint last frame's heads in the trail colour; woken columns keep a bright trail.
  for (let i = 0; i < cols; i++) {
    const row = lastRow[i];
    if (row < 0) continue;
    ctx.fillStyle = boost[i] > 0 ? colors.rainHead : colors.accent;
    ctx.fillText(glyphs[lastGlyph[i]], i * step, row * fontSize);
  }

  // Draw the new heads.
  ctx.fillStyle = colors.rainHead;
  for (let i = 0; i < cols; i++) {
    const woken = boost[i] > 0;
    if (woken) boost[i] -= 1;
    drops[i] += woken ? speeds[i] * 2 : speeds[i];
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
  /** Pointer at (x, y) in CSS pixels: wakes nearby columns. No-op when static. */
  wake(x: number, y: number): void;
  pause(): void;
  resume(): void;
  /** Frames painted since creation (for manual frame-rate checks). */
  frames(): number;
  destroy(): void;
}

/** Pointer idle time before the auto-ripple starts, and its period. */
export const IDLE_MS = 10_000;
export const RIPPLE_EVERY_MS = 8_000;
const RIPPLE_BAND_PX = 28;
const RIPPLE_SPEED_PX = 18;

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
  // Idle ripple: after IDLE_MS without a pointer, a soft wake band sweeps out
  // from the centre once every RIPPLE_EVERY_MS.
  let lastActivity = -1;
  let lastRipple = -1;
  let ripple: { x: number; r: number } | null = null;

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
      if (lastActivity < 0) lastActivity = now;
      if (
        !ripple &&
        now - lastActivity >= IDLE_MS &&
        (lastRipple < 0 || now - lastRipple >= RIPPLE_EVERY_MS)
      ) {
        ripple = { x: state.width / 2, r: 0 };
        lastRipple = now;
      }
      if (ripple) {
        // Two thin bands, left and right of the centre, moving outwards.
        wakeRain(state, ripple.x - ripple.r, RIPPLE_BAND_PX);
        wakeRain(state, ripple.x + ripple.r, RIPPLE_BAND_PX);
        ripple.r += RIPPLE_SPEED_PX;
        if (ripple.r > state.width / 2 + RIPPLE_BAND_PX) ripple = null;
      }
      stepRain(ctx, state, style);
      painted++;
    }
    handle = scheduler.request(tick, interval());
  }

  function start() {
    if (handle === null && !paused && animated()) handle = scheduler.request(tick, interval());
  }

  return {
    configure(next) {
      stop();
      config = next;
      surface.width = Math.max(1, Math.round(next.width * next.dpr));
      surface.height = Math.max(1, Math.round(next.height * next.dpr));
      ctx.setTransform(next.dpr, 0, 0, next.dpr, 0, 0);
      if (next.budget.fps <= 0) {
        state = null;
        drawStaticFrame(ctx, next.width, next.height, next.budget.density, style);
        painted++;
        return;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = style.colors.background;
      ctx.fillRect(0, 0, next.width, next.height);
      state = createRainState(next.width, next.height, style.fontSize, next.budget.density);
      start();
    },
    wake(x) {
      if (!state || !animated()) return;
      lastActivity = last;
      ripple = null;
      wakeRain(state, x);
    },
    pause() {
      paused = true;
      stop();
    },
    resume() {
      paused = false;
      start();
    },
    frames: () => painted,
    destroy() {
      paused = true;
      stop();
      config = null;
      state = null;
    },
  };
}
