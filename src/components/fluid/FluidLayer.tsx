"use client";

import { useEffect } from "react";
import {
  createFluidSim,
  getFluidContext,
  type FluidOptions,
  type FluidSim,
  type RGB,
} from "@/lib/fluid/fluid-sim";
import { readFluidMode, subscribeFluidMode } from "@/lib/fluid/fluid-mode";
import { pickDye, staticGradient } from "@/lib/fluid/palette";
import { readPill, subscribePill, type Pill } from "@/lib/pill";
import {
  cancelLayerFrame,
  isSoftwareRenderer,
  lowPowerDevice,
  motionAllowed,
  pageVisible,
  requestLayerFrame,
} from "@/lib/render-budget";

/**
 * The FluidMechanics dye fluid behind the page: the pointer (or touch) stirs
 * it, a click drops a burst, scrolling drags it, a pill choice floods it with
 * the new mode's colours, and after 10 s of stillness it stirs itself.
 *
 * States on `data-fluid-state`:
 * - running: loop active;
 * - idle: settled, no frames requested until the next input;
 * - paused: tab hidden or canvas offscreen;
 * - still: reduced motion or calm effects, one frame drawn, no loop;
 * - static: no WebGL2, a CSS gradient instead.
 *
 * With a live sim, `<html data-fluid-live>` lets the "chars" fluid mode
 * (src/lib/fluid/fluid-mode.ts) multiply the dye through the rain digits.
 */

const LAYER_ID = "fluid";
const SETTLE_ID = "fluid-settle";
/**
 * Sim steps per frame while settling a still frame (reduced motion, CPU
 * renderers). On a CPU renderer one step costs several ms of main thread, so
 * it settles one step a frame there.
 */
const SETTLE_STEPS_PER_FRAME = 5;
/** How often a CPU-renderer snapshot checks that the rasteriser has caught up. */
const FENCE_POLL_MS = 50;
const SPLAT_FORCE = 6000;
const SETTLE_MS = 6000;
const IDLE_MS = 10_000;
const COLOR_SWAP_MS = 350;
/** In "chars" mode the dye lights the digits it sits under, so it shows brighter. */
const CHARS_GAIN = 6;

type State = "running" | "idle" | "paused" | "still" | "static";

function mode(): Pill {
  return readPill() ?? "both";
}

export default function FluidLayer() {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.className = "fluid-layer";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("role", "presentation");
    canvas.dataset.testid = "fluid";
    document.body.append(canvas);

    // CPU renderers only: a 2D copy of the settled dye, shown while the WebGL canvas is hidden.
    let snap: HTMLCanvasElement | null = null;

    // The rain canvas is appended to <body> too; keep the fluid after it so it paints on top.
    const keepLast = new MutationObserver(() => {
      const last = snap ?? canvas;
      if (
        canvas.nextElementSibling?.classList.contains("matrix-rain") ||
        last.nextElementSibling?.classList.contains("matrix-rain")
      ) {
        document.body.append(canvas);
        if (snap) document.body.append(snap);
      }
    });
    keepLast.observe(document.body, { childList: true });

    const setState = (s: State) => {
      canvas.dataset.fluidState = s;
    };

    let disposed = false;
    let teardown: (() => void) | undefined;
    const gl = getFluidContext(canvas);
    const software = isSoftwareRenderer(gl);
    // CPU renderers and phones / low-end devices run a smaller grid with fewer solver passes.
    const opts: Partial<FluidOptions> = software
      ? { simResolution: 64, dyeResolution: 256, pressureIterations: 10 }
      : lowPowerDevice()
        ? { simResolution: 96, dyeResolution: 256, pressureIterations: 16 }
        : {};
    // On a CPU renderer a visible WebGL canvas costs ~50 ms of main thread on every page
    // frame (and far more on its first), even when the sim is idle. There it stays hidden
    // and a 2D copy of the settled dye shows instead, except while input stirs it.
    if (software) canvas.style.visibility = "hidden";

    // No usable WebGL2: a frozen CSS gradient in the same palette.
    const fallBack = (): (() => void) => {
      canvas.remove();
      keepLast.disconnect();
      const still = document.createElement("div");
      still.className = "fluid-layer fluid-layer--static";
      still.setAttribute("aria-hidden", "true");
      still.dataset.testid = "fluid";
      still.dataset.fluidState = "static";
      const paint = () => {
        still.style.backgroundImage = staticGradient(mode());
      };
      paint();
      document.body.append(still);
      const unsub = subscribePill(paint);
      return () => {
        unsub();
        still.remove();
      };
    };

    if (!gl) teardown = fallBack();
    else {
      // Compiles in the background (or one program per task), never as one long task.
      void createFluidSim(canvas, gl, opts).then((sim) => {
        if (disposed) sim?.destroy();
        else teardown = sim ? start(sim) : fallBack();
      });
    }

    return () => {
      disposed = true;
      snap?.remove();
      if (teardown) teardown();
      else {
        keepLast.disconnect();
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      }
    };

    function start(sim: FluidSim): () => void {
      // Character mode: CSS multiplies this canvas over the rain; the gain lifts the dye.
      const root = document.documentElement;
      root.dataset.fluidLive = "true";
      const frozen = () => canvas.style.visibility === "hidden";
      const applyMode = () => {
        sim.setGain(readFluidMode() === "chars" ? CHARS_GAIN : 1);
        // CPU renderer while frozen: refresh the copy (none yet: the splash is still settling).
        if (software && frozen()) {
          if (snap) freeze();
        } else sim.render();
      };
      applyMode();
      const unsubMode = subscribeFluidMode(applyMode);
      const unmount = () => {
        unsubMode();
        delete root.dataset.fluidLive;
      };

      const live = motionAllowed();
      let running = false;
      let lastInput = performance.now();
      let lastFrame = 0;
      let visible = true;
      let pointer: { x: number; y: number; color: RGB; swapped: number } | null = null;
      let lastScroll = window.scrollY;
      let idleTimer: ReturnType<typeof setInterval> | undefined;

      // Bumped by every freeze and thaw, so a copy that resolves late is dropped.
      let snapshot = 0;

      /**
       * CPU renderer: copies the dye into the snapshot canvas, then hides the
       * WebGL canvas. Any copy (drawImage, createImageBitmap) blocks the main
       * thread until the CPU rasteriser has run every queued sim step, often
       * hundreds of ms, so it first waits on a fence, polled without blocking,
       * and then copies after one fresh display pass.
       */
      function freeze(): void {
        if (!software || disposed) return;
        const token = ++snapshot;
        const gl = sim.gl;
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const stale = () => disposed || token !== snapshot;
        const poll = () => {
          if (stale()) {
            if (fence) gl.deleteSync(fence);
            return;
          }
          if (fence && gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) {
            setTimeout(poll, FENCE_POLL_MS);
            return;
          }
          if (fence) gl.deleteSync(fence);
          // Drawn and captured in one task: the WebGL drawing buffer is not preserved.
          sim.render();
          createImageBitmap(canvas).then(
            (bitmap) => {
              if (stale()) {
                bitmap.close();
                return;
              }
              if (!snap) {
                snap = document.createElement("canvas");
                snap.className = "fluid-layer";
                snap.setAttribute("aria-hidden", "true");
                snap.setAttribute("role", "presentation");
                canvas.after(snap);
              }
              const shown = snap.getContext("bitmaprenderer");
              if (shown) shown.transferFromImageBitmap(bitmap);
              else {
                snap.width = bitmap.width;
                snap.height = bitmap.height;
                snap.getContext("2d")?.drawImage(bitmap, 0, 0);
                bitmap.close();
              }
              snap.style.visibility = "";
              canvas.style.visibility = "hidden";
            },
            () => {},
          );
        };
        setTimeout(poll, FENCE_POLL_MS);
      }

      /** Shows the live WebGL canvas again (input is stirring the dye). */
      const thaw = () => {
        snapshot++;
        if (!frozen()) return;
        canvas.style.visibility = "";
        if (snap) snap.style.visibility = "hidden";
      };

      const burst = (count: number, strength = 1) => {
        const pill = mode();
        for (let i = 0; i < count; i++) {
          const c = pickDye(pill);
          sim.splat(
            0.15 + Math.random() * 0.7,
            0.15 + Math.random() * 0.7,
            (Math.random() - 0.5) * 1000 * strength,
            (Math.random() - 0.5) * 1000 * strength,
            [c[0] * 8, c[1] * 8, c[2] * 8],
          );
        }
      };

      // Advances the sim `steps` times, a few per frame, so settling never blocks the main thread.
      const settle = (steps: number, done?: () => void) => {
        let left = steps;
        const run = () => {
          if (disposed) return;
          const n = Math.min(software ? 1 : SETTLE_STEPS_PER_FRAME, left);
          for (let i = 0; i < n; i++) sim.step(1 / 60);
          left -= n;
          if (left > 0) requestLayerFrame(SETTLE_ID, run);
          else done?.();
        };
        requestLayerFrame(SETTLE_ID, run);
      };

      const stillFrame = () => {
        burst(6, 1.4);
        settle(40, freeze);
        setState("still");
      };

      const tick = (t: number) => {
        if (!running) return;
        const dt = lastFrame ? Math.min((t - lastFrame) / 1000, 1 / 60) : 1 / 60;
        lastFrame = t;
        sim.resize();
        sim.step(dt);
        if (performance.now() - lastInput > SETTLE_MS) {
          running = false;
          lastFrame = 0;
          setState("idle");
          freeze();
          return;
        }
        requestLayerFrame(LAYER_ID, tick);
      };

      const wake = () => {
        lastInput = performance.now();
        if (running || !visible || !pageVisible()) return;
        thaw();
        running = true;
        setState("running");
        requestLayerFrame(LAYER_ID, tick);
      };

      const pause = () => {
        running = false;
        lastFrame = 0;
        cancelLayerFrame(LAYER_ID);
        setState("paused");
      };

      if (!live) {
        stillFrame();
        const unsub = subscribePill(stillFrame);
        const onResize = () => {
          if (sim.resize()) stillFrame();
        };
        window.addEventListener("resize", onResize);
        return () => {
          unsub();
          unmount();
          window.removeEventListener("resize", onResize);
          keepLast.disconnect();
          sim.destroy();
          canvas.remove();
        };
      }

      const onMove = (e: PointerEvent) => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const x = e.clientX / w;
        const y = 1 - e.clientY / h;
        const now = performance.now();
        if (!pointer) {
          pointer = { x, y, color: pickDye(mode()), swapped: now };
          return;
        }
        if (now - pointer.swapped > COLOR_SWAP_MS) {
          pointer.color = pickDye(mode());
          pointer.swapped = now;
        }
        const aspect = w / h;
        let dx = x - pointer.x;
        let dy = y - pointer.y;
        if (aspect < 1) dx *= aspect;
        if (aspect > 1) dy /= aspect;
        pointer.x = x;
        pointer.y = y;
        if (Math.abs(dx) + Math.abs(dy) < 1e-5) return;
        sim.splat(x, y, dx * SPLAT_FORCE, dy * SPLAT_FORCE, pointer.color);
        wake();
      };

      const onDown = (e: PointerEvent) => {
        const c = pickDye(mode());
        sim.splat(
          e.clientX / canvas.clientWidth,
          1 - e.clientY / canvas.clientHeight,
          (Math.random() - 0.5) * 600,
          (Math.random() - 0.5) * 600,
          [c[0] * 10, c[1] * 10, c[2] * 10],
        );
        wake();
      };

      const onScroll = () => {
        const delta = window.scrollY - lastScroll;
        lastScroll = window.scrollY;
        if (Math.abs(delta) < 2) return;
        const c = pickDye(mode(), Math.random, 0.08);
        // Scrolling drags the dye the opposite way, like a body moving through water.
        sim.splat(
          0.2 + Math.random() * 0.6,
          delta > 0 ? 0.08 : 0.92,
          0,
          Math.max(-900, Math.min(900, delta * 6)),
          c,
        );
        wake();
      };

      const onPill = () => {
        burst(7, 1.6);
        wake();
      };

      const onVisibility = () => {
        if (document.hidden) pause();
        else if (visible) {
          setState("idle");
          wake();
        }
      };

      const io = new IntersectionObserver(([entry]) => {
        const was = visible;
        visible = entry?.isIntersecting ?? true;
        if (!visible) pause();
        // Resume only after an offscreen pause; the first callback must not start a loop.
        else if (!was && pageVisible()) wake();
      });
      io.observe(canvas);

      const onResize = () => {
        if (sim.resize()) sim.render();
        wake();
      };

      // Idle auto-stir, as FluidMechanics did; skipped on CPU renderers so lab runs stay calm.
      if (!software) {
        idleTimer = setInterval(() => {
          if (!pageVisible() || performance.now() - lastInput < IDLE_MS) return;
          burst(3, 1);
          wake();
        }, 2000);
      }

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      // On CPU renderers only the pointer stirs the fluid; keyboard scrolling stays cheap.
      if (!software) window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      const unsubPill = subscribePill(onPill);

      // Opening splash: the page arrives already in motion.
      burst(5, 1.2);
      setState("idle");
      if (software) {
        // CPU renderer: draw the splash as a settled frame; only real input runs the loop.
        settle(30, freeze);
      } else {
        wake();
      }

      return () => {
        pause();
        cancelLayerFrame(SETTLE_ID);
        clearInterval(idleTimer);
        io.disconnect();
        keepLast.disconnect();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        unsubPill();
        unmount();
        sim.destroy();
        canvas.remove();
      };
    }
  }, []);

  return null;
}
