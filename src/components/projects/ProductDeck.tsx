import type { CSSProperties } from "react";
import DeckController from "@/components/projects/DeckController";
import ProductOverview from "@/components/projects/ProductOverview";
import type { Project } from "@/data/projects";

/**
 * The products as a 3D deck of cards standing in a folder, in every mode. A
 * tall wrapper holds a sticky, viewport-high pin; scroll.css scrubs the cards
 * on the wrapper's view timeline: each segment holds the front card still,
 * then peels it up and out of the folder in perspective while the next one
 * rises to the front. No wheel handling: native scroll drives it. Without
 * support, under reduced motion or in calm, the cards are a plain list, one
 * per screen. Each card is a frosted surface; nothing above it may set
 * opacity, filter or mask, so the rain behind it stays blurred.
 */
export default function ProductDeck({ projects }: { projects: Project[] }) {
  const count = projects.length;
  return (
    <div data-deck="" className="deck" style={{ "--deck-count": count } as CSSProperties}>
      <div data-deck-pin="" className="deck-pin">
        <div className="deck-folder" aria-hidden="true">
          <span className="deck-tab">~/products</span>
        </div>
        {projects.map((project, i) => (
          <article
            key={project.slug}
            data-deck-card=""
            data-current={i === 0 ? "" : undefined}
            data-near={i === 0 ? "" : undefined}
            aria-labelledby={`pj-${project.slug}`}
            className="deck-card ov"
            style={{ "--i": i } as CSSProperties}
          >
            <ProductOverview
              project={project}
              index={i}
              count={count}
              headingId={`pj-${project.slug}`}
            />
          </article>
        ))}
        <div className="deck-lip" aria-hidden="true" />
      </div>
      <DeckController />
    </div>
  );
}
