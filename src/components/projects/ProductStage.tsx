import type { CSSProperties } from "react";
import ProductOverview from "@/components/projects/ProductOverview";
import StageController from "@/components/projects/StageController";
import type { Project } from "@/data/projects";

/**
 * BLUE: the pinned product stage (the FluidMechanics depth swap). A tall
 * wrapper holds a sticky, viewport-high stage; each product is a full-bleed
 * layer with the same overview as the other modes (ProductOverview) and a
 * user-facing number. scroll.css scrubs the layers on the wrapper's view
 * timeline: the next product flies in from depth while the current one falls
 * away. No wheel handling: native scroll drives it. Without support, under
 * reduced motion or in calm, the layers are a normal stacked list. The product
 * name is the button that opens its full-screen detail view.
 */
export default function ProductStage({ projects }: { projects: Project[] }) {
  const count = projects.length;
  return (
    <div
      data-show="blue"
      data-product-stage=""
      className="stage"
      style={{ "--stage-count": count } as CSSProperties}
    >
      <div data-stage-pin="" className="stage-pin">
        {projects.map((project, i) => (
          <article
            key={project.slug}
            data-show="blue"
            data-stage-layer=""
            data-first={i === 0 ? "" : undefined}
            data-last={i === count - 1 ? "" : undefined}
            data-current={i === 0 ? "" : undefined}
            aria-labelledby={`stage-${project.slug}`}
            className="stage-layer ov"
            style={{ "--i": i, "--o": 2 * i } as CSSProperties}
          >
            <ProductOverview
              project={project}
              index={i}
              count={count}
              headingId={`stage-${project.slug}`}
              figure="user"
            />
          </article>
        ))}
      </div>
      <StageController />
    </div>
  );
}
