"use client";

import { useEffect, useRef } from "react";
import {
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { readPill, subscribePill, type Pill } from "@/lib/pill";
import { subscribeEffects } from "@/lib/effects";
import { subscribeScroll } from "@/lib/scroll-progress";
import {
  cancelLayerFrame,
  cappedPixelRatio,
  isSoftwareRenderer,
  motionAllowed,
  pageVisible,
  requestLayerFrame,
  wantsAntialias,
} from "@/lib/render-budget";

const LAYER_ID = "pill-scene";

/** The figure: a generated portrait of the owner (keyed alpha, 1017 x 1220) and its baked depth map. */
export const FIGURE_SRC = "/hero/figure.webp";
const DEPTH_SRC = "/hero/figure-depth.png";

/** Where the pills sit in the figure image, as texture coordinates (v from the bottom). */
const RED_UV = new Vector2(0.229, 0.34);
const BLUE_UV = new Vector2(0.773, 0.34);

const RED = new Color("#ff2b45");
const BLUE = new Color("#2f8cff");
const GREEN = new Color("#3dff8f");

/** The rim light follows the mode: red, blue, or the matrix green for both. */
function modeColor(mode: Pill | null): Color {
  if (mode === "red") return RED;
  if (mode === "blue") return BLUE;
  return GREEN;
}

/** The figure plane: 5:6, the frame's aspect, 3 units tall. */
const PLANE_W = 2.5;
const PLANE_H = 3;
/** Below this v (from the bottom) the depth map is empty under the coat: hold the last depth. */
const FOOT_V = 0.21;
/** The coat fades out between these v values, above where the portrait's own fade ends (0.10). */
const FADE_FROM_V = 0.12;
const FADE_TO_V = 0.32;
/** How far the depth map pushes the figure toward the camera. */
const RELIEF = 0.42;

/** Camera rest pose and the scroll path over the first viewport height. */
const CAM = {
  fov: 30,
  start: { pos: new Vector3(0, 0, 5.75), target: new Vector3(0, 0, 0) },
  /** Half way: dollied in toward the hands. */
  mid: { pos: new Vector3(0, -0.45, 4.3), target: new Vector3(0, -0.55, 0) },
  /** End: tilted up toward the face. */
  end: { pos: new Vector3(0, 0.45, 4.1), target: new Vector3(0, 0.8, 0) },
};
const MAX_YAW = 0.2;
const MAX_PITCH = 0.1;
const POINTER_LERP = 0.08;
const STATE_LERP = 0.12;
/** Idle breathing: a swell of BREATH_MS every BREATH_EVERY_MS while visible. */
const BREATH_MS = 1600;
const BREATH_EVERY_MS = 4200;

type PillLook = { glow: number };

function pillTargets(mode: Pill | null): { red: PillLook; blue: PillLook } {
  if (mode === "red") return { red: { glow: 1.6 }, blue: { glow: 0.1 } };
  if (mode === "blue") return { red: { glow: 0.1 }, blue: { glow: 1.6 } };
  return { red: { glow: 0.9 }, blue: { glow: 0.9 } };
}

/**
 * The figure material: the portrait displaced by its depth map (so it turns
 * with the camera as a relief, not a flat card), a rim in the mode colour along
 * the silhouette, and a glow around each pill. The unchosen pill is dimmed.
 */
function figureMaterial(rim: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      map: { value: null },
      depthMap: { value: null },
      relief: { value: RELIEF },
      breath: { value: 0 },
      rimColor: { value: rim },
      redUv: { value: RED_UV },
      blueUv: { value: BLUE_UV },
      redColor: { value: RED.clone() },
      blueColor: { value: BLUE.clone() },
      redGlow: { value: 1 },
      blueGlow: { value: 1 },
      aspect: { value: PLANE_W / PLANE_H },
    },
    vertexShader: `uniform sampler2D depthMap; uniform float relief; uniform float breath;
      varying vec2 vUv; varying float vDepth;
      void main() {
        vUv = uv;
        // The depth map stops above the coat's baked fade; below FOOT_V the
        // coat keeps the depth it has there, so the hem does not step back.
        float d = texture2D(depthMap, vec2(uv.x, max(uv.y, ${FOOT_V.toFixed(3)}))).r;
        vDepth = d;
        vec3 p = position;
        p.z += d * relief;
        // Breathing: the chest and shoulders rise a little, the feet stay put.
        p.y += breath * 0.018 * smoothstep(0.0, 0.8, uv.y) * d;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 rimColor;
      uniform vec2 redUv; uniform vec2 blueUv; uniform vec3 redColor; uniform vec3 blueColor;
      uniform float redGlow; uniform float blueGlow; uniform float aspect;
      varying vec2 vUv; varying float vDepth;
      float near(vec2 a, vec2 b, float r) {
        vec2 d = (a - b) * vec2(aspect, 1.0);
        return exp(-dot(d, d) / (r * r));
      }
      void main() {
        vec4 tex = texture2D(map, vUv);
        vec3 col = tex.rgb;
        // The coat dissolves toward its foot, well above the image's own fade
        // edge, so no box or line is left where it ends.
        float foot = smoothstep(${FADE_FROM_V.toFixed(3)}, ${FADE_TO_V.toFixed(3)}, vUv.y);
        float a = tex.a * foot;
        // Dim the unchosen pill itself (a tight spot on the capsule).
        float rSpot = near(vUv, redUv, 0.035);
        float bSpot = near(vUv, blueUv, 0.035);
        col *= mix(1.0, clamp(0.35 + redGlow * 0.5, 0.35, 1.2), rSpot);
        col *= mix(1.0, clamp(0.35 + blueGlow * 0.5, 0.35, 1.2), bSpot);
        // Rim: thin edge where the relief falls away, in the mode colour.
        float edge = a * (1.0 - smoothstep(0.02, 0.2, vDepth));
        col += rimColor * edge * 0.9;
        // A soft halo round each pill, also over the background.
        float rHalo = near(vUv, redUv, 0.075) * redGlow;
        float bHalo = near(vUv, blueUv, 0.075) * blueGlow;
        vec3 halo = redColor * rHalo + blueColor * bHalo;
        col += halo * 0.4;
        float outA = max(a, clamp((rHalo + bHalo) * 0.45, 0.0, 0.8));
        gl_FragColor = vec4(col, outA);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

function buildScene() {
  const scene = new Scene();
  const rim = modeColor(readPill()).clone();
  const material = figureMaterial(rim);
  const figure = new Mesh(new PlaneGeometry(PLANE_W, PLANE_H, 100, 120), material);
  scene.add(figure);
  return { scene, figure, material, rim };
}

/** Loads an image into a texture without a loader: resolves null on error. */
function loadTexture(src: string, color: boolean): Promise<Texture | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const tex = new Texture(img);
      if (color) tex.colorSpace = SRGBColorSpace;
      // The portrait keeps mipmaps so it stays crisp, not shimmering, when the
      // frame is smaller than the 1017 px source (phones); the depth map does not need them.
      tex.minFilter = color ? LinearMipmapLinearFilter : LinearFilter;
      tex.generateMipmaps = color;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * The hero's real-time 3D scene: a generated portrait of the owner in a long
 * black coat and small round shades, offering a red pill (viewer's left) and a
 * blue pill (viewer's right) on open palms, drawn as a depth-displaced relief
 * so it turns with the camera. The chosen pill glows, the other dims; in
 * "both" the two glow evenly. The camera eases toward the pointer and follows
 * a short scroll path. Draws on demand only, on the shared layer frame from
 * `render-budget`, and only while `#top` is on screen and the tab is visible.
 * Under reduced motion, calm effects or a CPU-only WebGL (no GPU) it draws
 * still frames only: one once the portrait loads and one per pill change.
 * Decorative: the container is aria-hidden; the pill buttons stay real DOM.
 */
export default function PillScene3D() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: wantsAntialias(),
        powerPreference: "low-power",
      });
    } catch {
      // No WebGL: the portrait poster under the canvas stays as the visual.
      box.dataset.sceneFallback = "true";
      return;
    }
    renderer.setPixelRatio(cappedPixelRatio());
    renderer.setClearColor(0x000000, 0);

    const { scene, figure, material, rim } = buildScene();
    let rimTo = modeColor(readPill());
    // Nothing is drawn until the figure and its depth map have loaded.
    let loaded = false;
    const camera = new PerspectiveCamera(CAM.fov, 5 / 6, 0.1, 40);

    // No GPU (a CPU rasteriser): still frames only, redrawn when the pill changes.
    const software = isSoftwareRenderer(
      typeof renderer.getContext === "function" ? renderer.getContext() : null,
    );
    const canAnimate = () => motionAllowed() && !software;
    let animate = canAnimate();
    box.dataset.sceneMotion = animate ? "live" : "still";
    let visible = true;
    let running = false;
    let stopped = false;
    let ready = false;

    // Targets (what input asks for) and current values (what is drawn).
    const pointer = { x: 0, y: 0 };
    const look = { yaw: 0, pitch: 0 };
    let heroP = 0;
    let camP = 0;
    let looks = pillTargets(readPill());
    const shown = { red: { ...looks.red }, blue: { ...looks.blue } };
    let breathUntil = 0;
    let breathTimer: ReturnType<typeof setTimeout> | undefined;

    const pos = new Vector3();
    const target = new Vector3();
    const offset = new Vector3();

    function resize(): void {
      const w = Math.max(1, box!.clientWidth);
      const h = Math.max(1, box!.clientHeight || Math.round((w * 6) / 5));
      renderer.setPixelRatio(cappedPixelRatio());
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function placeCamera(): void {
      const t = camP;
      if (t <= 0.5) {
        const k = t / 0.5;
        pos.lerpVectors(CAM.start.pos, CAM.mid.pos, k);
        target.lerpVectors(CAM.start.target, CAM.mid.target, k);
      } else {
        const k = (t - 0.5) / 0.5;
        pos.lerpVectors(CAM.mid.pos, CAM.end.pos, k);
        target.lerpVectors(CAM.mid.target, CAM.end.target, k);
      }
      // Orbit the camera around its target by the pointer yaw and pitch.
      offset.subVectors(pos, target);
      offset.applyAxisAngle(new Vector3(0, 1, 0), look.yaw);
      offset.applyAxisAngle(new Vector3(1, 0, 0), look.pitch);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
    }

    function applyPills(time: number): void {
      const breathing = animate && time < breathUntil;
      const breath = breathing ? Math.sin(((breathUntil - time) / BREATH_MS) * Math.PI) : 0;
      const u = material.uniforms;
      u.breath.value = breath;
      u.redGlow.value = shown.red.glow * (1 + 0.15 * breath);
      u.blueGlow.value = shown.blue.glow * (1 + 0.15 * breath);
    }

    function draw(time: number): void {
      if (!loaded) return;
      placeCamera();
      applyPills(time);
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        box!.dataset.sceneReady = "true";
      }
    }

    /** Moves current values toward targets; true while anything is still moving. */
    function step(time: number): boolean {
      let moving = false;
      const ease = (cur: number, to: number, k: number) => {
        const next = cur + (to - cur) * k;
        if (Math.abs(to - next) > 1e-4) moving = true;
        return Math.abs(to - next) > 1e-4 ? next : to;
      };
      look.yaw = ease(look.yaw, pointer.x * MAX_YAW, POINTER_LERP);
      look.pitch = ease(look.pitch, pointer.y * MAX_PITCH, POINTER_LERP);
      camP = ease(camP, heroP, 0.2);
      for (const key of ["red", "blue"] as const) {
        const s = shown[key];
        const to = looks[key];
        s.glow = ease(s.glow, to.glow, STATE_LERP);
      }
      const c = rim;
      c.setRGB(
        ease(c.r, rimTo.r, STATE_LERP),
        ease(c.g, rimTo.g, STATE_LERP),
        ease(c.b, rimTo.b, STATE_LERP),
      );
      return moving || time < breathUntil;
    }

    function tick(time: number): void {
      running = false;
      if (stopped || !animate || !visible || !pageVisible()) return;
      const moving = step(time);
      draw(time);
      if (moving) wake();
    }

    /** Asks for a frame if the loop may run and none is pending. */
    function wake(): void {
      if (stopped || !animate || !visible || !pageVisible() || running) return;
      running = true;
      requestLayerFrame(LAYER_ID, tick);
    }

    /** Still mode: jump to targets and draw once, synchronously, with no frame request. */
    function still(): void {
      look.yaw = 0;
      look.pitch = 0;
      camP = 0;
      shown.red = { ...looks.red };
      shown.blue = { ...looks.blue };
      rim.copy(rimTo);
      draw(0);
    }

    function scheduleBreath(): void {
      clearTimeout(breathTimer);
      if (!animate) return;
      breathTimer = setTimeout(() => {
        if (visible && pageVisible()) {
          breathUntil = performance.now() + BREATH_MS;
          wake();
        }
        scheduleBreath();
      }, BREATH_EVERY_MS);
    }

    resize();
    // Load the portrait and its depth map; the poster stays until both are in.
    let textures: (Texture | null)[] = [];
    void Promise.all([loadTexture(FIGURE_SRC, true), loadTexture(DEPTH_SRC, false)]).then(
      (loadedTextures) => {
        textures = loadedTextures;
        if (stopped) {
          for (const t of loadedTextures) t?.dispose();
          return;
        }
        const [map, depth] = loadedTextures;
        if (!map || !depth) {
          box.dataset.sceneFallback = "true";
          return;
        }
        material.uniforms.map.value = map;
        material.uniforms.depthMap.value = depth;
        loaded = true;
        if (animate) {
          draw(performance.now());
          wake();
        } else still();
      },
    );

    const onPill = () => {
      looks = pillTargets(readPill());
      rimTo = modeColor(readPill());
      if (animate) wake();
      else still();
    };
    const offPill = subscribePill(onPill);

    let offScroll: () => void = () => {};
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pointer.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      wake();
    };
    function startMotion(): void {
      offScroll = subscribeScroll((s) => {
        heroP = s.heroP;
        wake();
      });
      window.addEventListener("pointermove", onPointer, { passive: true });
      scheduleBreath();
    }
    function stopMotion(): void {
      offScroll();
      offScroll = () => {};
      window.removeEventListener("pointermove", onPointer);
      clearTimeout(breathTimer);
      cancelLayerFrame(LAYER_ID);
      running = false;
    }
    if (animate) startMotion();

    const offEffects = subscribeEffects(() => {
      const next = canAnimate();
      if (next === animate) return;
      animate = next;
      box!.dataset.sceneMotion = animate ? "live" : "still";
      if (animate) {
        startMotion();
        wake();
      } else {
        stopMotion();
        still();
      }
    });

    const onVisibility = () => {
      if (pageVisible()) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Pause while the hero is off screen.
    const section = box.closest("#top") ?? box;
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) visible = entry.isIntersecting;
        if (visible) wake();
        else {
          cancelLayerFrame(LAYER_ID);
          running = false;
        }
      });
      io.observe(section);
    }

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        resize();
        if (animate) wake();
        else draw(0);
      });
      ro.observe(box);
    }

    return () => {
      stopped = true;
      stopMotion();
      offPill();
      offEffects();
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      ro?.disconnect();
      figure.geometry.dispose();
      material.dispose();
      for (const t of textures) t?.dispose();
      renderer.dispose();
      delete box.dataset.sceneReady;
    };
  }, []);

  return (
    <div ref={boxRef} className="scene-3d" aria-hidden="true">
      <canvas ref={canvasRef} className="scene-canvas" />
    </div>
  );
}
