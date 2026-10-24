import type { JSX } from "react";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import {
  alsoMe,
  interests,
  nowPlaying,
  personalityIntro,
  type InterestCard,
} from "@/data/personality";

const iconBase = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  focusable: "false" as const,
};

/** One plain line icon per interest (SVG only, no glyphs). */
const ICONS: Record<InterestCard["id"], JSX.Element> = {
  music: (
    <svg {...iconBase}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  ),
  chess: (
    <svg {...iconBase}>
      <path d="M8 21h8M7 18h10l-1-4H8l-1 4zM9 14l1-5h4l1 5" />
      <circle cx="12" cy="6" r="2.5" />
    </svg>
  ),
  games: (
    <svg {...iconBase}>
      <rect x="2.5" y="7" width="19" height="11" rx="5" />
      <path d="M7 11v3M5.5 12.5h3" />
      <circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" />
      <circle cx="17.5" cy="13.5" r="0.9" fill="currentColor" />
    </svg>
  ),
  ai: (
    <svg {...iconBase}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      <path d="M10 10h4v4h-4z" />
    </svg>
  ),
};

/** Three bars, like a playing track. Decorative. */
function EqualizerIcon() {
  return (
    <svg {...iconBase} className="me-eq">
      <path d="M6 20V10M12 20V4M18 20v-7" />
    </svg>
  );
}

/**
 * GREEN: the person behind the products, shown to visitors who take no pill
 * and just scroll. A "now playing" list, then one card per interest, then a
 * short "also me" line. Interests only.
 */
export default function Personality() {
  return (
    <section
      id="me"
      data-show="both"
      aria-labelledby="me-title"
      className="sect sect--me"
      data-motion="blue"
    >
      <SectionWord>Me</SectionWord>
      <div className="sect-inner">
        <SectionHeading id="me-title" command="whoami" title="The person behind it" />
        <p className="me-intro" data-enter="bottom">
          {personalityIntro}
        </p>

        <div className="me-grid">
          <div className="me-playing panel" data-enter="left">
            <p className="me-kicker">
              <EqualizerIcon /> Now playing, on repeat
            </p>
            <ol className="me-tracks">
              {nowPlaying.map((track, i) => (
                <li key={track.title} className="me-track">
                  <span className="me-track-n" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="me-track-text">
                    <span className="me-track-title">{track.title}</span>
                    <span className="me-track-from">{track.from}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <ul className="me-cards">
            {interests.map((card, i) => (
              <li
                key={card.id}
                className="me-card panel"
                data-enter={i % 2 === 0 ? "bottom" : "top"}
                data-stagger={String(i + 1)}
              >
                <h3 className="me-card-title">
                  <span className="me-card-icon">{ICONS[card.id]}</span>
                  {card.title}
                </h3>
                <p className="me-card-lede">{card.lede}</p>
                <ul className="me-card-points">
                  {card.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <p className="me-also" data-enter="bottom">
          <span className="me-also-label">Also me</span> {alsoMe}
        </p>
      </div>
    </section>
  );
}
