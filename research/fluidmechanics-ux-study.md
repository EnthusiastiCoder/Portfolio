# FluidMechanics UX study (for portfolio redesign v2)

Date: 2026-11-23. Source: private repos `EnthusiastiCoder/FluidMechanics` and `EnthusiastiCoder/Fluids`,
shallow-cloned read-only into the session scratch dir (never committed, remote untouched).
The site was NOT run locally: it needs a full `npm install` of three/r3f/gsap/tone/katex, which the
machine cannot afford right now. Findings come from the source, its session-state doc and its plans.

## What FluidMechanics is
A scroll journey through 7 fluid equations (Archimedes to Prandtl). One page, Next 16, React 19.
Layer stack (`app/src/app/page.tsx`):

| z | Layer | What it does |
|---|-------|--------------|
| 0 | `FluidCanvas` | PavelDoGreat WebGL Navier-Stokes sim, full-screen, `pointer-events:none`, listens on `window`. Hover leaves dye trails, click splats 5 bursts. Idle 10 s: auto-splats so the page never looks dead. |
| 20 | `ScrollAnimator` | Content in a FIXED viewport with `mix-blend-mode: difference`, so white text inverts over the moving dye. |
| 30 | `RippleOverlay` | WebGL height-map ripple rings on click (drop, propagate with 0.995 damping, render gradient). |
| 31 | `HoverParticles` | Canvas 2D sparkles: 3 per mousemove, 20 on click, soft glow, 60-120 frame life. |
| - | `CustomCursor` | Custom circle cursor: lerp 0.15 follow, "breathing" size 38-42 px, a pulsing ring every 2 s until first interaction (an affordance hint), hidden on `pointer: coarse`. |
| - | `FluidAudio` | Tone.js ambient drone + pentatonic notes on hover, click, scroll, drip. Mute stored in localStorage. |

## The signature move: depth-zoom section swap (`ScrollAnimator.tsx`)
- No normal scrolling. All sections are stacked `absolute inset-0` in a fixed viewport.
- A wheel/key/swipe step triggers a 1.6 s GSAP timeline, `power2.inOut`:
  the outgoing section scales to 1/20 (desktop) or 1/100 (mobile) and fades (it falls away into the distance),
  while the incoming one starts at scale 20 (flying in from behind the viewer) and settles at 1.
  Backward reverses the direction. This is what makes it feel "crazy": you travel THROUGH the page in depth.
- Wheel threshold 20, trackpad accumulation window 80 ms, swipe threshold 50 px, 200 ms lock after each move.
- A vertical dot indicator (right edge) shows and jumps to sections.
- Its own plan (`plans/scroll-animation.md`) moves toward GSAP ScrollTrigger `scrub: 1` + Lenis over a
  1200vh spacer, with a different transition per section themed on the physics:
  rise from below (buoyancy), scale/compress (pressure), fast horizontal sweep (accelerating flow), clean dissolve.

## Layout tricks
- Alternating two-column sections (text left / portrait right, flipped every index).
- Portraits grayscale with a radial-gradient `mask-image` so they melt into the background.
- Oversized uppercase type (`text-9xl`, `tracking-tighter`), tiny wide-tracked labels (`tracking-[0.5em]`).
- Footer splits one sentence across two lines pinned to opposite corners (left, then right).
- `mix-blend-difference` everywhere text overlaps motion.

## Fluids ("Liquid Worlds") - the related repo
- R3F scene behind normal scroll; each 100vh section is a "world" (water, lava, glass, energy).
- `CameraRig`: scroll progress maps onto a list of camera positions; the camera lerps between
  them (`delta * 2`), so scrolling is flying a camera along a path.
- Lenis smooth scroll feeding GSAP ScrollTrigger; scroll VELOCITY drives shader intensity.
- Section titles play/reverse on enter/leave (`toggleActions: "play reverse play reverse"`).
- Quality toggle (auto-detected, user-cyclable), loading screen, keyboard section nav, scroll % readout.

## Motion system it documents (`docs/research/03-premium-motion-archetype.md`)
- Durations 350/500/800 ms; signature ease `cubic-bezier(0.4,0,0.2,1)`, emphasized `(0.05,0.7,0.1,1)`, exit `(0.3,0,1,1)`.
- Three layers in every section: primary (100%), secondary (30-50%), ambient (10-20%).
- Stagger 80-200 ms, total under 500 ms. Counter-motion: hero moves right, background shifts left at 20-30%.
- Parallax speeds 1.0 / 0.5 / 0.2 / 0.1. Mouse parallax 10-20 px foreground, 5-10 px opposite background.
- Animate transform, opacity and clip-path only. Never width/height/margin/box-shadow.

## What to carry into the portfolio (and what not)
| Pattern | Carry? | How, within the light-bundle rule |
|---------|--------|-----------------------------------|
| Depth-zoom section swap | YES, adapted | Pinned (`position: sticky`) product stage scrubbed by scroll: each product flies in from depth (scale 6 to 1) while the previous falls away (1 to 0.2). Native scroll, no wheel hijack (a11y, keyboard, find-in-page keep working). |
| Per-section themed transitions | YES | Each section enters from its own direction (left, right, top, bottom, depth, rotation). Red and blue have different sets. |
| Camera on a scroll path | YES | The Three.js Morpheus scene: camera dollies along a short path over 0-100vh. |
| Pointer-reactive ambient layer + idle auto-motion | YES, cheap | Matrix rain reacts to the pointer (columns near it brighten and scatter); idle 10 s triggers a soft auto-ripple. No fluid sim. |
| mix-blend-difference text over motion | YES | Oversized hero/section words over the rain/canvas. |
| Custom breathing cursor | Blue only, `pointer: fine` only | Native cursor stays visible underneath for a11y; disabled under reduced motion. |
| Masked portraits/shots (radial mask) | YES | Blue screenshots bleed into the background. |
| Opposite-corner split sentences | YES | Section intros and footer. |
| Dot section indicator | YES | Right-edge nav, real links. |
| GSAP, Lenis, R3F, Tone.js, katex, webgl-fluid | NO | Too heavy for the bundle cap. CSS scroll-driven animations (`animation-timeline: view()/scroll()`) plus one tiny rAF scroll-progress helper do the scrub. No audio. |
| Wheel hijack (`preventDefault` on wheel) | NO | Breaks keyboard, screen readers and trackpads. |
