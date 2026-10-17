"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  LatheGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Scene,
  SphereGeometry,
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
  motionAllowed,
  pageVisible,
  requestLayerFrame,
  wantsAntialias,
} from "@/lib/render-budget";

const LAYER_ID = "pill-scene";

const RED = new Color("#ff2b45");
const BLUE = new Color("#2f8cff");

/** Camera rest pose and the scroll path over the first viewport height. */
const CAM = {
  fov: 30,
  start: { pos: new Vector3(0, 1.6, 6.4), target: new Vector3(0, 0.95, 0) },
  /** Half way: dollied in toward the hands. */
  mid: { pos: new Vector3(0, 1.15, 3.9), target: new Vector3(0, 0.62, 0.5) },
  /** End: tilted up toward the face. */
  end: { pos: new Vector3(0, 1.0, 4.2), target: new Vector3(0, 1.7, 0) },
};
const MAX_YAW = 0.25;
const MAX_PITCH = 0.12;
const POINTER_LERP = 0.08;
const STATE_LERP = 0.12;
/** Idle breathing: a bob burst of BREATH_MS every BREATH_EVERY_MS while visible. */
const BREATH_MS = 1600;
const BREATH_EVERY_MS = 4200;

type PillLook = { glow: number; scale: number; light: number };

function pillTargets(mode: Pill | null): { red: PillLook; blue: PillLook } {
  const lit: PillLook = { glow: 2.4, scale: 1.15, light: 2.2 };
  const dim: PillLook = { glow: 0.25, scale: 0.9, light: 0.15 };
  const even: PillLook = { glow: 1.5, scale: 1, light: 1.3 };
  if (mode === "red") return { red: lit, blue: dim };
  if (mode === "blue") return { red: dim, blue: lit };
  return { red: even, blue: even };
}

/** A cylinder spanning two points (an arm segment). */
function limb(from: Vector3, to: Vector3, r0: number, r1: number, mat: Material): Mesh {
  const dir = new Vector3().subVectors(to, from);
  const geo = new CylinderGeometry(r1, r0, dir.length(), 7);
  const mesh = new Mesh(geo, mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
  return mesh;
}

type Hand = {
  group: Group;
  pill: Mesh;
  halo: Mesh;
  light: PointLight;
  pillMat: MeshStandardMaterial;
};

/** Open palm facing up, fingers forward, a pill resting on it. `side` is -1 (viewer's left) or 1. */
function makeHand(side: -1 | 1, color: Color, skin: Material): Hand {
  const group = new Group();
  const palm = new Mesh(new BoxGeometry(0.22, 0.05, 0.22), skin);
  group.add(palm);
  for (let i = 0; i < 4; i++) {
    const finger = new Mesh(new CapsuleGeometry(0.022, 0.1, 2, 6), skin);
    finger.rotation.x = Math.PI / 2 - 0.25;
    finger.position.set(-0.075 + i * 0.05, 0.015, 0.16);
    group.add(finger);
  }
  const thumb = new Mesh(new CapsuleGeometry(0.024, 0.08, 2, 6), skin);
  thumb.rotation.z = (Math.PI / 2) * side;
  thumb.rotation.y = 0.5 * side;
  thumb.position.set(-0.14 * side, 0.02, 0.02);
  group.add(thumb);

  const pillMat = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.5,
    roughness: 0.25,
    metalness: 0.1,
  });
  const pill = new Mesh(new CapsuleGeometry(0.055, 0.12, 4, 12), pillMat);
  pill.rotation.z = Math.PI / 2;
  pill.rotation.y = 0.35 * side;
  pill.position.set(0, 0.09, 0.02);
  group.add(pill);

  const halo = new Mesh(
    new SphereGeometry(0.2, 16, 10),
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.copy(pill.position);
  group.add(halo);

  const light = new PointLight(color, 1.3, 1.6, 1.2);
  light.position.set(0, 0.25, 0.05);
  group.add(light);
  return { group, pill, halo, light, pillMat };
}

/** The original, procedural figure: long coat, bald head, small dark shades, open palms. */
function buildScene() {
  const scene = new Scene();
  scene.fog = new Fog(new Color("#020604"), 6, 14);

  const coat = new MeshStandardMaterial({
    color: "#0e1611",
    roughness: 0.55,
    metalness: 0.25,
    flatShading: true,
  });
  const skin = new MeshStandardMaterial({
    color: "#5a3d2e",
    roughness: 0.6,
    metalness: 0.05,
    flatShading: true,
  });
  const lens = new MeshStandardMaterial({ color: "#020302", roughness: 0.08, metalness: 0.95 });

  const figure = new Group();
  scene.add(figure);

  // Long coat: a low-poly lathe flaring from the shoulders to the hem, flattened front to back.
  const profile = [
    [0.0, 1.62],
    [0.4, 1.6],
    [0.56, 1.46],
    [0.53, 1.05],
    [0.5, 0.55],
    [0.57, 0.0],
    [0.7, -0.8],
    [0.84, -1.5],
    [0.0, -1.5],
  ].map(([x, y]) => new Vector2(x, y));
  const body = new Mesh(new LatheGeometry(profile.reverse(), 9), coat);
  body.scale.set(1, 1, 0.68);
  figure.add(body);

  // Raised collar: two panels leaning out from the neck.
  for (const side of [-1, 1]) {
    const collar = new Mesh(new BoxGeometry(0.12, 0.34, 0.035), coat);
    collar.position.set(0.17 * side, 1.66, 0.16);
    collar.rotation.set(-0.25, 0.35 * side, -0.32 * side);
    figure.add(collar);
    // Lapel edge: a thin brighter strip down the chest.
    const lapel = new Mesh(
      new BoxGeometry(0.03, 0.55, 0.02),
      new MeshStandardMaterial({ color: "#1f3326", roughness: 0.4, metalness: 0.4 }),
    );
    lapel.position.set(0.09 * side, 1.25, 0.36);
    lapel.rotation.z = -0.28 * side;
    figure.add(lapel);
  }

  const neck = new Mesh(new CylinderGeometry(0.12, 0.14, 0.24, 8), skin);
  neck.position.set(0, 1.72, 0);
  figure.add(neck);

  const head = new Mesh(new IcosahedronGeometry(0.3, 1), skin);
  head.scale.set(0.95, 1.18, 1.02);
  head.position.set(0, 2.0, 0.02);
  figure.add(head);

  // Small dark shades: two flattened boxes, a bridge and short temples.
  for (const side of [-1, 1]) {
    const glass = new Mesh(new BoxGeometry(0.15, 0.075, 0.03), lens);
    glass.position.set(0.095 * side, 2.03, 0.3);
    glass.rotation.y = 0.18 * side;
    figure.add(glass);
    const temple = new Mesh(new BoxGeometry(0.014, 0.014, 0.24), lens);
    temple.position.set(0.18 * side, 2.04, 0.18);
    figure.add(temple);
  }
  const bridge = new Mesh(new BoxGeometry(0.05, 0.014, 0.02), lens);
  bridge.position.set(0, 2.045, 0.31);
  figure.add(bridge);

  // Arms: sleeves from the shoulders, bent at the elbow, forearms held forward.
  const hands: Record<"red" | "blue", Hand> = {
    red: makeHand(-1, RED, skin),
    blue: makeHand(1, BLUE, skin),
  };
  for (const [side, hand] of [
    [-1, hands.red],
    [1, hands.blue],
  ] as const) {
    const shoulder = new Vector3(0.5 * side, 1.46, 0);
    const elbow = new Vector3(0.64 * side, 0.86, 0.22);
    const wrist = new Vector3(0.66 * side, 0.7, 0.8);
    figure.add(limb(shoulder, elbow, 0.15, 0.13, coat));
    figure.add(limb(elbow, wrist, 0.13, 0.1, coat));
    const cuff = new Mesh(new SphereGeometry(0.13, 8, 6), coat);
    cuff.position.copy(elbow);
    figure.add(cuff);
    hand.group.position.set(wrist.x, wrist.y - 0.04, wrist.z + 0.1);
    hand.group.rotation.x = 0.1;
    figure.add(hand.group);
  }

  // Lights: a sky/ground fill, a green rim from behind, a soft key from the front.
  scene.add(new HemisphereLight(new Color("#7fa58c"), new Color("#030604"), 0.9));
  const rim = new DirectionalLight(new Color("#3dff8f"), 2.4);
  rim.position.set(-2.5, 3, -3);
  scene.add(rim);
  const key = new DirectionalLight(new Color("#f2fff6"), 1.3);
  key.position.set(1.8, 3.2, 4);
  scene.add(key);

  // Faint green grid floor.
  const grid = new GridHelper(14, 28, new Color("#1f7a45"), new Color("#0c3a20"));
  grid.position.y = -1.5;
  const gridMat = grid.material as Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.45;
  scene.add(grid);

  return { scene, hands };
}

function disposeScene(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.geometry instanceof BufferGeometry) mesh.geometry.dispose();
    const mat = mesh.material as Material | Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat && typeof mat.dispose === "function") mat.dispose();
  });
}

/**
 * The hero's real-time 3D scene: an original low-poly figure in a long coat
 * and small dark shades, offering a red pill (viewer's left) and a blue pill
 * (viewer's right) on open palms. The chosen pill glows, the other dims; in
 * "both" the two glow evenly. The camera eases toward the pointer and follows
 * a short scroll path. Draws on demand only, on the shared layer frame from
 * `render-budget`, and only while `#top` is on screen and the tab is visible.
 * Under reduced motion or calm effects it draws one still frame.
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
      // No WebGL: the SVG poster under the canvas stays as the visual.
      box.dataset.sceneFallback = "true";
      return;
    }
    renderer.setPixelRatio(cappedPixelRatio());
    renderer.setClearColor(0x000000, 0);

    const { scene, hands } = buildScene();
    const camera = new PerspectiveCamera(CAM.fov, 5 / 6, 0.1, 40);

    let animate = motionAllowed();
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
      for (const key of ["red", "blue"] as const) {
        const hand = hands[key];
        const s = shown[key];
        const bob = breathing ? Math.sin(((breathUntil - time) / BREATH_MS) * Math.PI * 2) : 0;
        const swell =
          1 + (breathing ? 0.04 * Math.sin(((breathUntil - time) / BREATH_MS) * Math.PI) : 0);
        hand.pill.scale.setScalar(s.scale * swell);
        hand.pill.position.y = 0.09 + 0.025 * bob * (key === "red" ? 1 : -1);
        hand.halo.position.y = hand.pill.position.y;
        hand.halo.scale.setScalar(0.6 + s.glow * 0.25);
        (hand.halo.material as MeshBasicMaterial).opacity = 0.06 + s.glow * 0.08;
        hand.pillMat.emissiveIntensity = s.glow;
        hand.light.intensity = s.light;
      }
    }

    function draw(time: number): void {
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
        s.scale = ease(s.scale, to.scale, STATE_LERP);
        s.light = ease(s.light, to.light, STATE_LERP);
      }
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
    // The first frame is drawn synchronously so the scene is ready at once.
    if (animate) draw(0);
    else still();

    const onPill = () => {
      looks = pillTargets(readPill());
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
      const next = motionAllowed();
      if (next === animate) return;
      animate = next;
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
      disposeScene(scene);
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
