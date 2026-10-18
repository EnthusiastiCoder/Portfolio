import Link from "next/link";
import type { CSSProperties } from "react";
import { PrimaryCta, ProductShot, SourceLink } from "@/components/projects/ProductCard";
import StageController from "@/components/projects/StageController";
import type { Project } from "@/data/projects";

/**
 * BLUE: the pinned product stage (the FluidMechanics depth swap). A tall
 * wrapper holds a sticky, viewport-high stage; each product is a full-bleed
 * layer. scroll.css scrubs the layers on the wrapper's view timeline: the next
 * product flies in from depth while the current one falls away. No wheel
 * handling: native scroll drives it. Without support, under reduced motion or
 * in calm, the layers are a normal stacked list.
 */
export default function ProductStage({ projects }: { projects: Project[] }) {
  const count = projects.length;
  return (
    <div
      data-show="blue both"
      data-product-stage=""
      className="stage"
      style={{ "--stage-count": count } as CSSProperties}
    >
      <div data-stage-pin="" className="stage-pin">
        {projects.map((project, i) => (
          <article
            key={project.slug}
            data-show="blue both"
            data-stage-layer=""
            data-first={i === 0 ? "" : undefined}
            data-last={i === count - 1 ? "" : undefined}
            data-current={i === 0 ? "" : undefined}
            aria-labelledby={`stage-${project.slug}`}
            className="stage-layer"
            style={{ "--i": i, "--o": 2 * i } as CSSProperties}
          >
            <div className="stage-shot">
              <ProductShot project={project} sizes="(min-width: 768px) 70vw, 100vw" />
            </div>
            <div className="stage-copy">
              <p className="stage-count" aria-hidden="true">
                {String(i + 1).padStart(2, "0")} of {String(count).padStart(2, "0")}
              </p>
              <h3 id={`stage-${project.slug}`} className="stage-name">
                {project.title}
              </h3>
              <p className="stage-audience">
                <span className="stage-kicker">Who it helps</span> {project.audience}
              </p>
              <p className="stage-story">{project.story}</p>
              <p className="stage-actions">
                <PrimaryCta project={project} className="cta-primary--big" />
                <Link href={`/projects/${project.slug}`} className="stage-more">
                  How it feels to use
                </Link>
                <SourceLink project={project} />
              </p>
            </div>
          </article>
        ))}
      </div>
      <StageController />
    </div>
  );
}
