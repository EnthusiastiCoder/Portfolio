"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  LatheGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
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

const RED = new Color("#ff2b45");
const BLUE = new Color("#2f8cff");
const GREEN = new Color("#3dff8f");

/** The rim light follows the mode: red, blue, or the matrix green for both. */
function modeColor(mode: Pill | null): Color {
  if (mode === "red") return RED;
  if (mode === "blue") return BLUE;
  return GREEN;
}

/** Camera rest pose and the scroll path over the first viewport height. */
const CAM = {
  fov: 30,
  start: { pos: new Vector3(0, 1.5, 6.6), target: new Vector3(0, 1.0, 0) },
  /** Half way: dollied in toward the hands. */
  mid: { pos: new Vector3(0, 1.15, 3.9), target: new Vector3(0, 0.7, 0.5) },
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
/** Resting height of a pill above its palm. */
const PILL_Y = 0.075;

type PillLook = { glow: number; scale: number };

function pillTargets(mode: Pill | null): { red: PillLook; blue: PillLook } {
  const lit: PillLook = { glow: 2.4, scale: 1.15 };
  const dim: PillLook = { glow: 0.25, scale: 0.9 };
  const even: PillLook = { glow: 1.5, scale: 1 };
  if (mode === "red") return { red: lit, blue: dim };
  if (mode === "blue") return { red: dim, blue: lit };
  return { red: even, blue: even };
}

/** Shared rim colour: every rim-lit material reads this one uniform. */
type RimUniform = { value: Color };

/**
 * A standard material with a fresnel rim added to its emission: edges that
 * turn away from the camera glow in the mode colour, so the figure reads as a
 * sleek, back-lit silhouette.
 */
function rimMaterial(
  rim: RimUniform,
  params: ConstructorParameters<typeof MeshStandardMaterial>[0],
  strength: number,
  power: number,
): MeshStandardMaterial {
  const mat = new MeshStandardMaterial(params);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = rim;
    shader.uniforms.rimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += rimColor * rimStrength * pow(rimF, ${power.toFixed(2)});`,
      );
  };
  mat.customProgramCacheKey = () => `rim-${strength}-${power}`;
  return mat;
}

/** A soft additive glow: bright where the sphere faces the camera, fading to nothing at its edge. */
function glowMaterial(color: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { glowColor: { value: color.clone() }, strength: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 glowColor; uniform float strength; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 2.2);
        float a = clamp(f * strength, 0.0, 1.0);
        gl_FragColor = vec4(glowColor * a, a * 0.25);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

/** A smooth tube spanning two points (an arm segment). */
function limb(from: Vector3, to: Vector3, r0: number, r1: number, mat: Material): Mesh {
  const dir = new Vector3().subVectors(to, from);
  const geo = new CylinderGeometry(r1, r0, dir.length(), 20, 1, true);
  const mesh = new Mesh(geo, mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
  return mesh;
}

/** A smooth ball, scaled into an ellipsoid. */
function blob(mat: Material, sx: number, sy: number, sz: number): Mesh {
  const mesh = new Mesh(new SphereGeometry(1, 24, 16), mat);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

type Hand = {
  group: Group;
  pill: Mesh;
  halo: Mesh;
  light: PointLight;
  pillMat: MeshStandardMaterial;
  haloMat: ShaderMaterial;
};

/**
 * Open palm facing up and tilted toward the viewer: a rounded palm, four
 * capsule fingers fanned forward and slightly cupped, the thumb out to the
 * side, a glowing pill resting in the palm. `side` is -1 (viewer's left) or 1.
 */
function makeHand(side: -1 | 1, color: Color, skin: Material): Hand {
  const group = new Group();
  const palm = blob(skin, 0.095, 0.03, 0.09);
  group.add(palm);
  const lengths = [0.075, 0.09, 0.085, 0.065];
  for (let i = 0; i < 4; i++) {
    const len = lengths[side === 1 ? i : 3 - i];
    const finger = new Mesh(new CapsuleGeometry(0.017, len, 4, 10), skin);
    finger.rotation.x = Math.PI / 2 - 0.35;
    finger.rotation.z = (1.5 - i) * -0.09;
    finger.position.set(-0.06 + i * 0.04, 0.012, 0.085 + len / 2);
    group.add(finger);
  }
  const thumb = new Mesh(new CapsuleGeometry(0.02, 0.06, 4, 10), skin);
  thumb.rotation.set(Math.PI / 2 - 0.2, 0, -0.9 * side);
  thumb.position.set(0.1 * side, 0.014, 0.035);
  group.add(thumb);

  const pillMat = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.5,
    roughness: 0.18,
    metalness: 0.0,
  });
  const pill = new Mesh(new CapsuleGeometry(0.045, 0.1, 8, 20), pillMat);
  pill.rotation.z = Math.PI / 2;
  pill.rotation.y = 0.35 * side;
  pill.position.set(0, PILL_Y, 0.02);
  group.add(pill);

  const haloMat = glowMaterial(color);
  const halo = new Mesh(new SphereGeometry(0.3, 24, 16), haloMat);
  halo.position.copy(pill.position);
  group.add(halo);

  // The pill lights its own palm, sleeve and coat front in its colour.
  const light = new PointLight(color, 0.3, 1.4, 2);
  light.position.set(0, PILL_Y + 0.06, 0.06);
  group.add(light);
  return { group, pill, halo, light, pillMat, haloMat };
}

/** A smooth head: one sphere, tapered toward the jaw and chin. */
function headGeometry(): SphereGeometry {
  const geo = new SphereGeometry(1, 40, 30);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // The lower half narrows toward the chin; the back of the skull stays round.
    const k = y < 0 ? Math.pow(-y, 1.6) : 0;
    p.setX(i, p.getX(i) * (1 - 0.32 * k));
    p.setZ(i, p.getZ(i) * (1 - 0.12 * k));
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * The original, procedural figure, stylised: a long dark coat with a raised
 * collar, a smooth bald head, small round reflective shades, open palms. Lit
 * mostly from behind, so it reads as a silhouette with a mode-coloured rim.
 */
function buildScene() {
  const scene = new Scene();
  scene.fog = new Fog(new Color("#020604"), 7, 14);
  const rim: RimUniform = { value: modeColor(readPill()).clone() };

  const coat = rimMaterial(rim, { color: "#0a0d0f", roughness: 0.38, metalness: 0.4 }, 0.9, 3.2);
  const coatInner = rimMaterial(
    rim,
    { color: "#050606", roughness: 0.5, metalness: 0.2, side: DoubleSide },
    0.7,
    3.2,
  );
  const skin = rimMaterial(rim, { color: "#6e4834", roughness: 0.42, metalness: 0.05 }, 0.35, 3.0);
  // The lenses mirror a pale sky at their edges, whatever the mode.
  const lens = rimMaterial(
    { value: new Color("#b8c8d8") },
    { color: "#020304", roughness: 0.05, metalness: 0.0 },
    0.9,
    1.8,
  );
  const frameMat = new MeshStandardMaterial({ color: "#2c3238", roughness: 0.3, metalness: 0.8 });

  const figure = new Group();
  scene.add(figure);

  // Long coat: a smooth lathe with rounded shoulders, a slim waist and a
  // straight drape to the hem, flattened front to back. The seam faces away.
  const profile = [
    [0.0, 1.64],
    [0.18, 1.64],
    [0.33, 1.6],
    [0.48, 1.54],
    [0.55, 1.43],
    [0.54, 1.25],
    [0.47, 0.95],
    [0.39, 0.6],
    [0.38, 0.25],
    [0.41, -0.2],
    [0.46, -0.8],
    [0.5, -1.5],
    [0.0, -1.5],
  ].map(([x, y]) => new Vector2(x, y));
  const body = new Mesh(new LatheGeometry(profile.reverse(), 48, Math.PI), coat);
  body.scale.set(1, 1, 0.62);
  figure.add(body);

  // Raised collar: an open-fronted flared band around the neck.
  const collar = new Mesh(
    new CylinderGeometry(0.29, 0.17, 0.22, 32, 1, true, Math.PI * 0.3, Math.PI * 1.4),
    coatInner,
  );
  collar.position.set(0, 1.72, -0.03);
  collar.scale.set(1, 1, 0.85);
  figure.add(collar);

  const neck = new Mesh(new CylinderGeometry(0.1, 0.115, 0.26, 20, 1, true), skin);
  neck.position.set(0, 1.76, 0.01);
  figure.add(neck);

  const head = new Mesh(headGeometry(), skin);
  head.scale.set(0.235, 0.29, 0.27);
  head.position.set(0, 2.06, 0.03);
  figure.add(head);
  for (const side of [-1, 1]) {
    const ear = blob(skin, 0.025, 0.05, 0.035);
    ear.position.set(0.23 * side, 2.03, 0.0);
    figure.add(ear);
  }
  const nose = blob(skin, 0.022, 0.042, 0.03);
  nose.position.set(0, 1.99, 0.285);
  nose.rotation.x = -0.2;
  figure.add(nose);

  // Small round reflective shades: two lenses, thin metal rims, a bridge, no temples.
  for (const side of [-1, 1]) {
    const glass = blob(lens, 0.07, 0.046, 0.02);
    glass.position.set(0.08 * side, 2.055, 0.268);
    glass.rotation.y = 0.32 * side;
    figure.add(glass);
    const ring = new Mesh(new TorusGeometry(1, 0.05, 8, 32), frameMat);
    ring.scale.set(0.071, 0.047, 0.071);
    ring.position.copy(glass.position);
    ring.rotation.y = glass.rotation.y;
    figure.add(ring);
  }
  const bridge = new Mesh(new TorusGeometry(0.02, 0.004, 6, 16, Math.PI), frameMat);
  bridge.position.set(0, 2.06, 0.285);
  figure.add(bridge);

  // Arms: smooth sleeves from the shoulders, bent at the elbow, forearms held forward.
  const hands: Record<"red" | "blue", Hand> = {
    red: makeHand(-1, RED, skin),
    blue: makeHand(1, BLUE, skin),
  };
  for (const [side, hand] of [
    [-1, hands.red],
    [1, hands.blue],
  ] as const) {
    const shoulder = new Vector3(0.49 * side, 1.42, 0);
    const elbow = new Vector3(0.64 * side, 0.9, 0.12);
    const wrist = new Vector3(0.74 * side, 0.74, 0.7);
    figure.add(limb(shoulder, elbow, 0.13, 0.115, coat));
    figure.add(limb(elbow, wrist, 0.115, 0.095, coat));
    const shoulderCap = blob(coat, 0.13, 0.13, 0.13);
    shoulderCap.position.copy(shoulder);
    figure.add(shoulderCap);
    const elbowCap = blob(coat, 0.115, 0.115, 0.115);
    elbowCap.position.copy(elbow);
    figure.add(elbowCap);
    const cuff = new Mesh(new TorusGeometry(0.095, 0.014, 10, 28), coat);
    cuff.position.copy(wrist);
    cuff.quaternion.setFromUnitVectors(
      new Vector3(0, 0, 1),
      new Vector3().subVectors(wrist, elbow).normalize(),
    );
    figure.add(cuff);
    const wristSkin = new Mesh(new CylinderGeometry(0.04, 0.05, 0.12, 12), skin);
    wristSkin.position.set(wrist.x, wrist.y - 0.02, wrist.z + 0.05);
    wristSkin.rotation.x = Math.PI / 2 - 0.3;
    figure.add(wristSkin);
    hand.group.position.set(wrist.x, wrist.y - 0.04, wrist.z + 0.12);
    // Tilt the palm toward the camera so the open hand reads from the front.
    hand.group.rotation.x = 0.55;
    figure.add(hand.group);
  }

  // Lights: a low fill, a soft cool key from the front, two back lights in the
  // mode colour for the silhouette edge. The pills light their palms.
  scene.add(new HemisphereLight(new Color("#8fa59a"), new Color("#020303"), 0.45));
  const key = new DirectionalLight(new Color("#e8eef5"), 1.7);
  key.position.set(1.6, 3.0, 4.2);
  scene.add(key);
  const backs: DirectionalLight[] = [];
  for (const side of [-1, 1]) {
    const back = new DirectionalLight(rim.value.clone(), 2.6);
    back.position.set(3 * side, 2.4, -2.6);
    scene.add(back);
    backs.push(back);
  }

  return { scene, hands, rim, backs };
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
 * The hero's real-time 3D scene: an original stylised figure in a long coat
 * and small dark shades, offering a red pill (viewer's left) and a blue pill
 * (viewer's right) on open palms. The chosen pill glows, the other dims; in
 * "both" the two glow evenly. The camera eases toward the pointer and follows
 * a short scroll path. Draws on demand only, on the shared layer frame from
 * `render-budget`, and only while `#top` is on screen and the tab is visible.
 * Under reduced motion, calm effects or a CPU-only WebGL (no GPU) it draws
 * still frames only: one at start and one per pill change.
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

    const { scene, hands, rim, backs } = buildScene();
    let rimTo = modeColor(readPill());
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
      for (const key of ["red", "blue"] as const) {
        const hand = hands[key];
        const s = shown[key];
        const bob = breathing ? Math.sin(((breathUntil - time) / BREATH_MS) * Math.PI * 2) : 0;
        const swell =
          1 + (breathing ? 0.04 * Math.sin(((breathUntil - time) / BREATH_MS) * Math.PI) : 0);
        hand.pill.scale.setScalar(s.scale * swell);
        hand.pill.position.y = PILL_Y + 0.02 * bob * (key === "red" ? 1 : -1);
        hand.halo.position.y = hand.pill.position.y;
        hand.halo.scale.setScalar(0.8 + s.glow * 0.3);
        hand.haloMat.uniforms.strength.value = 0.1 + s.glow * 0.42;
        hand.light.intensity = 0.05 + s.glow * 0.3;
        hand.pillMat.emissiveIntensity = s.glow;
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
      }
      const c = rim.value;
      c.setRGB(
        ease(c.r, rimTo.r, STATE_LERP),
        ease(c.g, rimTo.g, STATE_LERP),
        ease(c.b, rimTo.b, STATE_LERP),
      );
      for (const back of backs) back.color.copy(c);
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
      rim.value.copy(rimTo);
      for (const back of backs) back.color.copy(rimTo);
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
