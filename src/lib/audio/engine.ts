/**
 * The FluidMechanics sound design on the plain Web Audio API (no Tone.js): a
 * warm, slowly breathing C-major drone through a long reverb, soft pentatonic
 * sine notes when the pointer moves fast (panned by x), a water drip on click,
 * a descending cascade when a new section scrolls in, and a chord on a pill
 * choice (low and dark for red, high and bright for blue).
 *
 * Loaded only by a dynamic import after the visitor turns sound on.
 */
import { PILL_EVENT, isPill, type Pill } from "@/lib/pill";

/** Written to <html data-sound-engine> on load; tests check it is absent from first load. */
export const AUDIO_ENGINE_MARK = "fluid-audio-engine-v1";

const HZ: Record<string, number> = {
  A2: 110,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  G3: 196,
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
};

const DRONE = ["C3", "E3", "G3"];
const HOVER = ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4"];
const DRIP = ["C5", "E5", "G5", "A5"];
const CASCADE = ["G5", "E5", "C5", "A4", "G4", "E4"];
const CHORDS: Record<Pill, string[]> = {
  red: ["A2", "C3", "E3", "A3"],
  blue: ["C4", "G4", "E5", "G5"],
  both: ["C3", "G3", "E4", "C5"],
};

export interface AudioEngine {
  setEnabled(on: boolean): Promise<void>;
  destroy(): void;
}

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  document.documentElement.dataset.soundEngine = AUDIO_ENGINE_MARK;

  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 5, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.6;
  reverb.connect(wet).connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.5;
  dry.connect(master);
  const bus = ctx.createGain();
  bus.connect(reverb);
  bus.connect(dry);

  // Drone: three sines through a 600 Hz lowpass with a very slow tremolo.
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.035;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 600;
  droneFilter.connect(droneGain).connect(bus);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.012;
  lfo.connect(lfoDepth).connect(droneGain.gain);
  lfo.start();
  const drones = DRONE.map((n, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = HZ[n];
    o.detune.value = (i - 1) * 4;
    o.connect(droneFilter);
    o.start();
    return o;
  });

  function tone(
    note: string,
    o: {
      at?: number;
      vol: number;
      attack: number;
      release: number;
      pan?: number;
      type?: OscillatorType;
      drop?: boolean;
    },
  ): void {
    const t = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(HZ[note], t);
    if (o.drop) osc.frequency.exponentialRampToValueAtTime(HZ[note] * 0.6, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol, t + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.attack + o.release);
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan ?? 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    osc.connect(g).connect(lp).connect(p).connect(bus);
    osc.start(t);
    osc.stop(t + o.attack + o.release + 0.05);
  }

  let enabled = false;
  const lastHover = new Array(HOVER.length).fill(0);
  let prev = { x: 0, y: 0, t: 0 };
  let lastCascade = 0;

  const onMove = (e: PointerEvent) => {
    const now = performance.now();
    const dt = now - prev.t;
    const v = Math.hypot(e.clientX - prev.x, e.clientY - prev.y) / Math.max(dt, 1);
    prev = { x: e.clientX, y: e.clientY, t: now };
    if (!enabled || v < 0.8) return;
    const nx = e.clientX / window.innerWidth;
    const i = Math.min(HOVER.length - 1, Math.max(0, Math.floor(nx * HOVER.length)));
    if (now - lastHover[i] < 220) return;
    lastHover[i] = now;
    tone(HOVER[i], { vol: 0.05, attack: 0.08, release: 1.6, pan: nx * 2 - 1 });
  };

  const onDown = (e: PointerEvent) => {
    if (!enabled) return;
    const note = DRIP[Math.floor(Math.random() * DRIP.length)];
    tone(note, {
      vol: 0.08,
      attack: 0.005,
      release: 0.9,
      pan: (e.clientX / window.innerWidth) * 2 - 1,
      drop: true,
    });
  };

  const onPill = (e: Event) => {
    if (!enabled) return;
    const p = (e as CustomEvent<unknown>).detail;
    const chord = CHORDS[isPill(p) ? p : "both"];
    chord.forEach((n, i) =>
      tone(n, {
        at: i * 0.07,
        vol: 0.06,
        attack: 0.04,
        release: 2.6,
        type: p === "red" ? "triangle" : "sine",
      }),
    );
  };

  // A section scrolling in plays the descending cascade, at most every 2.5 s.
  const sections = new IntersectionObserver(
    (entries) => {
      if (!enabled || !entries.some((en) => en.isIntersecting)) return;
      const now = performance.now();
      if (now - lastCascade < 2500) return;
      lastCascade = now;
      CASCADE.forEach((n, i) =>
        tone(n, { at: i * 0.22, vol: 0.025, attack: 0.12, release: 1.4, pan: Math.random() - 0.5 }),
      );
    },
    { threshold: 0.35 },
  );
  document.querySelectorAll("main section[id]").forEach((s) => sections.observe(s));

  const onVisibility = () => {
    if (!enabled) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(
      document.hidden ? 0 : 0.9,
      t + (document.hidden ? 1.5 : 0.5),
    );
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener(PILL_EVENT, onPill);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    async setEnabled(on: boolean) {
      enabled = on;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      if (on) {
        await ctx.resume();
        master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 2.5);
        tone(DRIP[0], { vol: 0.08, attack: 0.005, release: 0.9, drop: true });
      } else {
        master.gain.linearRampToValueAtTime(0, t + 0.4);
        setTimeout(() => {
          if (!enabled) void ctx.suspend();
        }, 500);
      }
    },
    destroy() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener(PILL_EVENT, onPill);
      document.removeEventListener("visibilitychange", onVisibility);
      sections.disconnect();
      drones.forEach((o) => o.stop());
      lfo.stop();
      void ctx.close();
    },
  };
}
