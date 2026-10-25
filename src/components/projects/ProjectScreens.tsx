import { ArrowRightIcon } from "@/components/icons";
import ModeOnly from "@/components/ModeOnly";
import { PrimaryCta, ProductShot, SourceLink } from "@/components/projects/ProductCard";
import { detailId } from "@/components/projects/ProjectDetail";
import type { Project } from "@/data/projects";
import { getImpact } from "@/data/impact";

/**
 * The button that opens a product's detail view. Its ::after stretches over
 * the whole card, so a click anywhere on the card opens it; Enter and Space
 * work because it is a real button. Links in the card sit above the stretch.
 */
export function OpenDetail({ project }: { project: Project }) {
  return (
    <button
      type="button"
      className="pj-open"
      data-project-open={project.slug}
      aria-haspopup="dialog"
      aria-controls={detailId(project.slug)}
    >
      {project.title}
    </button>
  );
}

/** The visible cue that the card opens. Decorative: the button carries the name. */
export function OpenHint() {
  return (
    <p className="pj-hint" aria-hidden="true">
      See how it&apos;s built <ArrowRightIcon className="pj-hint-icon" />
    </p>
  );
}

/**
 * RED and GREEN: one product per screen, as an overview only: the name, a
 * one-line pitch, the key visual and a highlight for the mode. Red shows the
 * two measured figures (the method is in the detail) and the skills the
 * product proves; green shows who it helps. The detail (the large
 * architecture and the rest) opens on click.
 */
export default function ProjectScreens({ projects }: { projects: Project[] }) {
  const count = projects.length;
  return (
    <div data-show="red both" className="pjs">
      {projects.map((project, i) => {
        const impact = getImpact(project.slug);
        return (
          <article key={project.slug} className="pj" aria-labelledby={`pj-${project.slug}`}>
            <div className="pj-visual" data-enter="depth-in">
              <ProductShot project={project} sizes="(min-width: 900px) 55vw, 100vw" />
            </div>
            <div className="pj-copy">
              <p className="pj-count" aria-hidden="true">
                {String(i + 1).padStart(2, "0")} of {String(count).padStart(2, "0")}
              </p>
              <h3 id={`pj-${project.slug}`} className="pj-name">
                <OpenDetail project={project} />
              </h3>
              <p className="pj-pitch">{project.tagline ?? project.summary}</p>

              <ModeOnly modes={["red"]} className="pj-high">
                <dl className="pj-facts">
                  {impact.slice(0, 2).map((m) => (
                    <div key={m.label} className="pj-fact pj-fact--figure" title={m.method}>
                      <dt>{m.label}</dt>
                      <dd className="pj-figure">{m.value}</dd>
                    </div>
                  ))}
                  <div className="pj-fact pj-fact--wide">
                    <dt>Skills it proves</dt>
                    <dd>{project.stack.slice(0, 6).join(", ")}</dd>
                  </div>
                </dl>
                {impact.length > 0 ? (
                  <p className="pj-method">
                    Measured on the live product. How: in the detail view.
                  </p>
                ) : null}
              </ModeOnly>

              <ModeOnly modes={["both"]} className="pj-high">
                <p className="pj-audience">
                  <span className="pj-kicker">Who it helps</span> {project.audience}
                </p>
              </ModeOnly>

              <OpenHint />
              <p className="pj-actions">
                <PrimaryCta project={project} />
                <SourceLink project={project} />
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
