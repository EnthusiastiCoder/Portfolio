"use client";

import { useEffect } from "react";
import {
  createFluidSim,
  getFluidContext,
  type FluidOptions,
  type RGB,
} from "@/lib/fluid/fluid-sim";
import { pickDye, staticGradient } from "@/lib/fluid/palette";
import { readPill, subscribePill, type Pill } from "@/lib/pill";
import {
  cancelLayerFrame,
  isSoftwareRenderer,
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
 */

const LAYER_ID = "fluid";
const SPLAT_FORCE = 6000;
const SETTLE_MS = 6000;
const IDLE_MS = 10_000;
const COLOR_SWAP_MS = 350;

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

    // The rain canvas is appended to <body> too; keep the fluid after it so it paints on top.
    const keepLast = new MutationObserver(() => {
      if (canvas.nextElementSibling?.classList.contains("matrix-rain"))
        document.body.append(canvas);
    });
    keepLast.observe(document.body, { childList: true });

    const setState = (s: State) => {
      canvas.dataset.fluidState = s;
    };

    const gl = getFluidContext(canvas);
    const software = isSoftwareRenderer(gl);
    const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    const opts: Partial<FluidOptions> = software
      ? { simResolution: 64, dyeResolution: 256, pressureIterations: 10 }
      : coarse
        ? { simResolution: 96, dyeResolution: 256 }
        : {};
    const sim = gl ? createFluidSim(canvas, gl, opts) : null;

    if (!sim) {
      // No usable WebGL2: a frozen CSS gradient in the same palette.
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
    }

    const live = motionAllowed();
    let running = false;
    let lastInput = performance.now();
    let lastFrame = 0;
    let visible = true;
    let pointer: { x: number; y: number; color: RGB; swapped: number } | null = null;
    let lastScroll = window.scrollY;
    let idleTimer: ReturnType<typeof setInterval> | undefined;

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

    const stillFrame = () => {
      burst(6, 1.4);
      for (let i = 0; i < 40; i++) sim.step(1 / 60);
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
        return;
      }
      requestLayerFrame(LAYER_ID, tick);
    };

    const wake = () => {
      lastInput = performance.now();
      if (running || !visible || !pageVisible()) return;
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
      visible = entry?.isIntersecting ?? true;
      if (!visible) pause();
      else if (pageVisible()) wake();
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
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    const unsubPill = subscribePill(onPill);

    // Opening splash: the page arrives already in motion.
    burst(5, 1.2);
    setState("idle");
    if (software) {
      // CPU renderer: draw the splash as a settled frame; only real input runs the loop.
      for (let i = 0; i < 30; i++) sim.step(1 / 60);
    } else {
      wake();
    }

    return () => {
      pause();
      clearInterval(idleTimer);
      io.disconnect();
      keepLast.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubPill();
      sim.destroy();
      canvas.remove();
    };
  }, []);

  return null;
}
