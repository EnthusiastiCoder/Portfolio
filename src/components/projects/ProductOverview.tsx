import { ArrowRightIcon } from "@/components/icons";
import ModeOnly from "@/components/ModeOnly";
import DemoVideo from "@/components/projects/DemoVideo";
import { PrimaryCta } from "@/components/projects/ProductCard";
import { detailId } from "@/components/projects/ProjectDetail";
import type { Project } from "@/data/projects";
import { getHeadlineImpact } from "@/data/impact";

/**
 * The button that opens a product's detail view. Its ::after stretches over
 * the whole overview, so a click anywhere on it opens the detail; Enter and
 * Space work because it is a real button. Links sit above the stretch.
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

/** Red: the measured headline figure; the method shows on hover and in the detail. */
function ImpactFigure({ project }: { project: Project }) {
  const metric = getHeadlineImpact(project.slug);
  if (!metric) return null;
  return (
    <dl className="ov-figure" title={metric.method}>
      <dt className="ov-figure-label">{metric.label}</dt>
      <dd className="ov-figure-value">{metric.value}</dd>
    </dl>
  );
}

/** Blue and green: one number a user cares about. */
function UserFigure({ project }: { project: Project }) {
  const { value, label } = project.userFigure;
  return (
    <p className="ov-figure">
      <span className="ov-figure-value">{value}</span>
      <span className="ov-figure-label">{label}</span>
    </p>
  );
}

/**
 * One product's overview, the same in every mode: the counter and name, the
 * use case, three headline features, one number and two actions on the left,
 * and the looping demo in a browser frame on the right. Everything longer
 * (who it helps, the story, the stack, every figure) is in the detail view.
 *
 * `figure` picks the number: "by-mode" renders red's measured figure and
 * green's user figure (CSS shows one), "user" renders only the user figure
 * (blue's stage).
 */
export default function ProductOverview({
  project,
  index,
  count,
  headingId,
  figure,
  enter = false,
}: {
  project: Project;
  index: number;
  count: number;
  headingId: string;
  figure: "by-mode" | "user";
  /** Red and green: the demo flies in from depth (it settles once fully on screen). */
  enter?: boolean;
}) {
  return (
    <>
      <div className="ov-copy">
        <p className="ov-count" aria-hidden="true">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </p>
        <h3 id={headingId} className="ov-name">
          <OpenDetail project={project} />
        </h3>
        <p className="ov-use">{project.useCase}</p>
        <ul className="ov-features" aria-label="Headline features">
          {project.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        {figure === "by-mode" ? (
          <>
            <ModeOnly modes={["red"]} className="ov-figure-slot">
              <ImpactFigure project={project} />
            </ModeOnly>
            <ModeOnly modes={["both"]} className="ov-figure-slot">
              <UserFigure project={project} />
            </ModeOnly>
          </>
        ) : (
          <div className="ov-figure-slot">
            <UserFigure project={project} />
          </div>
        )}
        <p className="ov-actions">
          <PrimaryCta project={project} />
          <button
            type="button"
            className="ov-how"
            data-project-open={project.slug}
            aria-haspopup="dialog"
            aria-controls={detailId(project.slug)}
          >
            How it&apos;s built <ArrowRightIcon className="ov-how-icon" />
          </button>
        </p>
      </div>
      <DemoVideo
        project={project}
        sizes="(min-width: 900px) 1200px, 140vw"
        className="ov-demo"
        enter={enter}
      />
    </>
  );
}
