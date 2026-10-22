import { ArrowDownIcon } from "@/components/icons";
import ModeOnly from "@/components/ModeOnly";
import PillChoice from "@/components/matrix/PillChoice";
import PillScene3DLoader from "@/components/matrix/PillScene3DLoader";
import SceneFigurePoster from "@/components/matrix/SceneFigurePoster";
import { profile } from "@/data/profile";

const NAME_CLASS = "hero-name-text";

/**
 * One block line per word, each kept on one line, so the title's height is
 * the same in the fallback font and the web font (no shift when fonts load).
 * The space between the words stays in the text, so the h1 still reads as the
 * full name.
 */
function NameLines({ caret = false }: { caret?: boolean }) {
  const words = profile.name.split(" ");
  const last = words.length - 1;
  return words.map((word, i) => (
    <span key={i}>
      <span className="hero-name-line">
        {word}
        {caret && i === last ? <span className="caret" aria-hidden="true" /> : null}
      </span>
      {i < last ? " " : null}
    </span>
  ));
}

/**
 * The first screen: an oversized, broken-grid name over the real-time 3D
 * scene (an original figure offering a red and a blue pill), with the pill
 * buttons beside the figure's hands on desktop and below it on mobile. The
 * scene sits in a fixed-aspect frame over its SVG poster, so it causes no
 * layout shift and the poster stays if WebGL is missing. The h1, the copy and
 * the buttons are server-rendered DOM outside the canvas; the glitch only
 * uses aria-hidden copies. Transparent, so the fixed rain shows behind.
 */
export default function PillScene() {
  return (
    <section id="top" aria-labelledby="hero-title" className="pill-scene hero">
      <div className="hero-title">
        <p className="hero-prompt text-muted text-sm" aria-hidden="true">
          <span className="text-accent">&gt;</span> whoami
        </p>
        <div id="hero-name" className="glitch">
          <h1 id="hero-title" className={`${NAME_CLASS} text-accent`}>
            <NameLines caret />
          </h1>
          <span className={`glitch-layer glitch-layer--r ${NAME_CLASS}`} aria-hidden="true">
            <NameLines />
          </span>
          <span className={`glitch-layer glitch-layer--b ${NAME_CLASS}`} aria-hidden="true">
            <NameLines />
          </span>
        </div>
      </div>

      <div className="scene-copy hero-copy">
        <p className="text-ink text-lg">
          {profile.role} <span className="text-muted">· {profile.location}</span>
        </p>
        <p className="text-muted mt-2">{profile.tagline}</p>
        <div className="hero-mode-copy mt-5">
          <ModeOnly as="div" modes={["red", "both"]} className="hero-line hero-line--red">
            Engineering in depth: architecture, trade-offs and the numbers behind each build.
          </ModeOnly>
          <ModeOnly as="div" modes={["blue", "both"]} className="hero-line hero-line--blue">
            I build tools that people can open and use straight away, and I care how they feel.
          </ModeOnly>
        </div>
        <p className="text-ink mt-5 leading-relaxed">
          Take a pill. Red goes deep into the engineering. Blue stays on the surface: the products,
          the design and who they help.
        </p>
        <p className="text-muted mt-4 text-sm">
          Or just scroll: you get both.{" "}
          <a href="#about" className="scene-cue">
            Skip ahead <ArrowDownIcon className="inline-block align-[-0.125em]" />
          </a>
        </p>
      </div>

      <div className="scene-figure hero-figure">
        <div className="scene-stage">
          <div className="scene-frame">
            <SceneFigurePoster />
            <PillScene3DLoader />
          </div>
          <PillChoice />
        </div>
      </div>
    </section>
  );
}
