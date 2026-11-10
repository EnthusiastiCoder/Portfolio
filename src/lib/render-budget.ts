/**
 * Shared rendering budget for every WebGL layer on the page: the 3D pill scene
 * now, the fluid layer later. Keeping these rules in one place means the layers
 * cap the pixel ratio the same way, stop under the same motion settings and
 * share one animation frame instead of running competing rAF loops.
 */

/** Highest device pixel ratio any canvas renders at. */
export const MAX_DPR = 2;

/** Device pixel ratio clamped to (0, MAX_DPR]. */
export function cappedPixelRatio(): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(Math.max(dpr, 0.5), MAX_DPR);
}

/** Antialiasing only pays for itself at DPR 1; above that the extra pixels smooth edges. */
export function wantsAntialias(): boolean {
  return typeof window !== "undefined" && (window.devicePixelRatio || 1) <= 1;
}

/**
 * True when continuous motion is allowed: effects are not "calm" and the
 * visitor has not asked for reduced motion. When false, layers draw one still
 * frame and run no loop.
 */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.effects === "calm") return false;
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/**
 * True on phones and low-end machines: a touch-first or narrow screen, four
 * or fewer CPU cores, or 4 GB or less of device memory. Layers start later and
 * run smaller there, so the first screen is not fighting them for the CPU.
 */
export function lowPowerDevice(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency || 8) <= 4) return true;
  if ((nav.deviceMemory ?? 8) <= 4) return true;
  if (window.innerWidth < 768) return true;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/** True while the tab is visible. */
export function pageVisible(): boolean {
  return typeof document === "undefined" || !document.hidden;
}

// One shared animation frame. Each layer registers a task under its own id;
// all due tasks run in the same frame, and no frame is requested when idle.
const tasks = new Map<string, FrameRequestCallback>();
let handle = 0;

function runFrame(time: number): void {
  handle = 0;
  const due = [...tasks.values()];
  tasks.clear();
  for (const task of due) task(time);
}

/** Runs `task` on the next shared animation frame (replacing any pending task with that id). */
export function requestLayerFrame(id: string, task: FrameRequestCallback): void {
  tasks.set(id, task);
  if (!handle) handle = window.requestAnimationFrame(runFrame);
}

/** Drops a pending task; cancels the shared frame when nothing else is due. */
export function cancelLayerFrame(id: string): void {
  tasks.delete(id);
  if (tasks.size === 0 && handle) {
    window.cancelAnimationFrame(handle);
    handle = 0;
  }
}

/**
 * True when the WebGL context runs on a CPU rasteriser (SwiftShader, llvmpipe,
 * Microsoft Basic Render). Such devices have no GPU to spare, so layers draw
 * still frames there instead of running a loop.
 */
export function isSoftwareRenderer(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null,
): boolean {
  if (!gl || typeof gl.getExtension !== "function") return false;
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(
      info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}
