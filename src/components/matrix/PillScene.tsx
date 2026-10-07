import ModeOnly from "@/components/ModeOnly";
import PillChoice from "@/components/matrix/PillChoice";
import { profile } from "@/data/profile";

const NAME_CLASS = "text-4xl font-bold leading-tight sm:text-6xl";

/**
 * Original illustrated figure: a silhouette in a long coat with a raised
 * collar and reflective shades, both palms open. Fixed width, height and
 * viewBox so it adds no layout shift. The chosen hand glows through CSS.
 */
function SceneFigure() {
  return (
    <svg
      className="scene-svg"
      width={400}
      height={480}
      viewBox="0 0 400 480"
      role="img"
      aria-label="Illustration: a figure in a long coat and dark shades holds out both open palms, one for each pill"
    >
      <defs>
        <radialGradient id="scene-aura" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scene-lens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a3a31" />
          <stop offset="55%" stopColor="#050806" />
          <stop offset="100%" stopColor="#14201a" />
        </linearGradient>
        <radialGradient id="scene-glow-red">
          <stop offset="0%" stopColor="#ff6b7a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ff6b7a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="scene-glow-blue">
          <stop offset="0%" stopColor="#6cc4ff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#6cc4ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="200" cy="230" rx="190" ry="215" fill="url(#scene-aura)" />

      <g fill="#060a07" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        {/* Long coat: shoulders falling to the frame edge. */}
        <path d="M62 480 C72 382 112 334 158 316 L242 316 C288 334 328 382 338 480 Z" />
        {/* Sleeves reaching forward to the open palms. */}
        <path d="M124 342 C102 360 82 384 66 404 L98 424 C116 404 136 384 154 368 Z" />
        <path d="M276 342 C298 360 318 384 334 404 L302 424 C284 404 264 384 246 368 Z" />
        {/* Neck. */}
        <path d="M182 262 L218 262 L222 318 L178 318 Z" fill="#0b100c" />
        {/* Raised collar. */}
        <path d="M160 318 L128 246 L188 302 Z" fill="#0a120d" />
        <path d="M240 318 L272 246 L212 302 Z" fill="#0a120d" />
        {/* Lapels. */}
        <path d="M178 318 L200 372 L222 318" fill="none" />
        {/* Head and ears. */}
        <ellipse cx="152" cy="220" rx="6" ry="12" fill="#0d130f" />
        <ellipse cx="248" cy="220" rx="6" ry="12" fill="#0d130f" />
        <ellipse cx="200" cy="214" rx="48" ry="60" fill="#0d130f" />
      </g>

      {/* Reflective shades with a glint. */}
      <g stroke="currentColor" strokeWidth="1.5">
        <path d="M158 208 L152 214 M242 208 L248 214" fill="none" />
        <ellipse cx="180" cy="210" rx="21" ry="14" fill="url(#scene-lens)" />
        <ellipse cx="220" cy="210" rx="21" ry="14" fill="url(#scene-lens)" />
        <path d="M199 207 Q200 204 201 207" fill="none" />
      </g>
      <g stroke="#e6ffe9" strokeWidth="2" strokeLinecap="round" opacity="0.75">
        <path d="M168 205 L177 201" />
        <path d="M208 205 L217 201" />
      </g>

      {/* Open palms; the viewer's left holds the red pill, the right the blue. */}
      <g className="scene-hand scene-hand--red">
        <ellipse
          className="scene-hand-glow"
          cx="82"
          cy="414"
          rx="70"
          ry="40"
          fill="url(#scene-glow-red)"
        />
        <g fill="#18211b" stroke="currentColor" strokeWidth="1.5">
          <rect x="44" y="392" width="10" height="26" rx="5" transform="rotate(-28 49 405)" />
          <rect x="60" y="384" width="10" height="28" rx="5" transform="rotate(-12 65 398)" />
          <rect x="76" y="382" width="10" height="29" rx="5" />
          <rect x="92" y="384" width="10" height="28" rx="5" transform="rotate(12 97 398)" />
          <ellipse cx="80" cy="418" rx="36" ry="14" />
          <rect x="108" y="404" width="10" height="24" rx="5" transform="rotate(52 113 416)" />
        </g>
      </g>
      <g className="scene-hand scene-hand--blue">
        <ellipse
          className="scene-hand-glow"
          cx="318"
          cy="414"
          rx="70"
          ry="40"
          fill="url(#scene-glow-blue)"
        />
        <g fill="#18211b" stroke="currentColor" strokeWidth="1.5">
          <rect x="346" y="392" width="10" height="26" rx="5" transform="rotate(28 351 405)" />
          <rect x="330" y="384" width="10" height="28" rx="5" transform="rotate(12 335 398)" />
          <rect x="314" y="382" width="10" height="29" rx="5" />
          <rect x="298" y="384" width="10" height="28" rx="5" transform="rotate(-12 303 398)" />
          <ellipse cx="320" cy="418" rx="36" ry="14" />
          <rect x="282" y="404" width="10" height="24" rx="5" transform="rotate(-52 287 416)" />
        </g>
      </g>
    </svg>
  );
}

/**
 * The first screen: name, role and original copy about choosing how deep to
 * go, next to the figure holding the two pills. Transparent, so the fixed rain
 * shows behind. The h1 is real SSR text at full opacity; the glitch only uses
 * aria-hidden copies.
 */
export default function PillScene() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="pill-scene grid min-h-[100svh] items-center gap-8 py-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
    >
      <div className="scene-copy panel p-6 sm:p-8">
        <p className="text-muted text-sm" aria-hidden="true">
          <span className="text-accent">&gt;</span> whoami
        </p>
        <div id="hero-name" className="glitch mt-3">
          <h1 id="hero-title" className={`${NAME_CLASS} text-accent text-glow`}>
            {profile.name}
            <span className="caret" aria-hidden="true" />
          </h1>
          <span className={`glitch-layer glitch-layer--r ${NAME_CLASS}`} aria-hidden="true">
            {profile.name}
          </span>
          <span className={`glitch-layer glitch-layer--b ${NAME_CLASS}`} aria-hidden="true">
            {profile.name}
          </span>
        </div>
        <p className="text-ink mt-4 text-lg">
          {profile.role} <span className="text-muted">· {profile.location}</span>
        </p>
        <p className="text-muted mt-2 max-w-2xl">{profile.tagline}</p>
        <p className="text-ink mt-6 max-w-2xl leading-relaxed">
          This site can be read two ways. The red pill goes deep: architecture, trade-offs and the
          numbers behind each build. The blue pill stays on the surface: screenshots, polish and the
          short version.
        </p>
        <p className="scene-mode text-muted mt-4 text-sm">
          <ModeOnly as="span" modes={["red"]}>
            Now showing: depth. Engineering notes first.
          </ModeOnly>
          <ModeOnly as="span" modes={["blue"]}>
            Now showing: surface. The quick, visual tour.
          </ModeOnly>
          <ModeOnly as="span" modes={["both"]}>
            Now showing: both. Depth and surface, blended.
          </ModeOnly>
        </p>
        <p className="text-muted mt-6 text-sm">
          Or just scroll: you get both.{" "}
          <a href="#about" className="scene-cue">
            Skip ahead<span aria-hidden="true"> ↓</span>
          </a>
        </p>
      </div>
      <div className="scene-figure">
        <div className="scene-stage">
          <SceneFigure />
          <PillChoice />
        </div>
      </div>
    </section>
  );
}
