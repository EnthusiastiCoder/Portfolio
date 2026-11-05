import Image from "next/image";
import Link from "next/link";
import ArchitectureDiagram from "@/components/projects/ArchitectureDiagram";
import ArchitectureFlow from "@/components/projects/ArchitectureFlow";
import { PrimaryCta, SourceLink } from "@/components/projects/ProductCard";
import type { Project } from "@/data/projects";
import { getImpact } from "@/data/impact";

/** The ids the overview buttons and the controller share. */
export const detailId = (slug: string) => `pd-${slug}`;

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

/**
 * One product's full-screen detail view, server-rendered as a closed native
 * <dialog> (no JS until it opens, nothing on screen while closed). The large
 * architecture comes first: an SVG that fills the width on wider screens and a
 * text flow on phones, then the measured impact, the story, the hard problems,
 * the trade-offs and the stack. ProjectDetailController opens and closes it.
 */
export default function ProjectDetail({
  project,
  index,
  count,
}: {
  project: Project;
  index: number;
  count: number;
}) {
  const id = detailId(project.slug);
  const titleId = `${id}-title`;
  const impact = getImpact(project.slug);
  const tradeoffs = project.depth?.tradeoffs ?? [];
  // The themed result shot, the last step of the overview's fan.
  const shot = project.usage[2];
  return (
    <dialog
      id={id}
      className="pd"
      aria-modal="true"
      aria-labelledby={titleId}
      data-project-detail={project.slug}
    >
      <div className="pd-bar">
        <button type="button" className="pd-back" data-project-close="">
          <BackIcon /> Back to projects
        </button>
        <p className="pd-count">
          Product {String(index + 1).padStart(2, "0")} of {String(count).padStart(2, "0")}
        </p>
      </div>

      <div className="pd-body">
        <header className="pd-head">
          <div className="pd-head-text">
            <h2 id={titleId} className="pd-title">
              {project.title}
            </h2>
            {project.tagline ? <p className="pd-pitch">{project.tagline}</p> : null}
            <p className="pd-summary">{project.summary}</p>
            <p className="pd-actions">
              <PrimaryCta project={project} />
              <SourceLink project={project} />
            </p>
          </div>
          <div className="pd-shot">
            <Image
              src={shot.src}
              alt={shot.alt}
              width={shot.width}
              height={shot.height}
              sizes="(min-width: 900px) 30vw, 90vw"
              loading="lazy"
            />
          </div>
        </header>

        <figure className="pd-arch">
          <figcaption className="pd-label">How it is built</figcaption>
          <ArchitectureDiagram
            diagram={project.diagram}
            title={project.title}
            className="pd-diagram"
          />
          <ArchitectureFlow diagram={project.diagram} title={project.title} className="pd-flow" />
        </figure>

        {impact.length > 0 ? (
          <section className="pd-sect" aria-labelledby={`${id}-impact`}>
            <h3 id={`${id}-impact`} className="pd-label">
              Measured impact
            </h3>
            <dl className="pd-impact">
              {impact.map((m) => (
                <div key={m.label} className="pd-impact-item">
                  <dt>{m.label}</dt>
                  <dd className="pd-figure">{m.value}</dd>
                  <dd className="pd-method">How it was measured: {m.method}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <div className="pd-cols">
          <section className="pd-sect" aria-labelledby={`${id}-story`}>
            <h3 id={`${id}-story`} className="pd-label">
              What it does
            </h3>
            <p className="pd-text">{project.story}</p>
            <p className="pd-text">
              <span className="pd-kicker">Who it helps</span> {project.audience}
            </p>
          </section>

          <section className="pd-sect" aria-labelledby={`${id}-problems`}>
            <h3 id={`${id}-problems`} className="pd-label">
              Hard problems
            </h3>
            <ol className="pd-problems">
              {project.hardProblems.map((hp) => (
                <li key={hp.problem}>
                  <p className="pd-problem">{hp.problem}</p>
                  <p className="pd-approach">{hp.approach}</p>
                </li>
              ))}
            </ol>
          </section>

          {tradeoffs.length > 0 ? (
            <section className="pd-sect" aria-labelledby={`${id}-tradeoffs`}>
              <h3 id={`${id}-tradeoffs`} className="pd-label">
                Trade-offs
              </h3>
              <ul className="pd-list">
                {tradeoffs.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="pd-sect" aria-labelledby={`${id}-design`}>
            <h3 id={`${id}-design`} className="pd-label">
              Design notes
            </h3>
            <ul className="pd-list">
              {project.design.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="pd-sect" aria-labelledby={`${id}-stack`}>
          <h3 id={`${id}-stack`} className="pd-label">
            Skills it proves
          </h3>
          <ul className="pd-stack">
            {project.stack.map((tech) => (
              <li key={tech}>{tech}</li>
            ))}
          </ul>
        </section>

        <p className="pd-more">
          <Link href={`/projects/${project.slug}`}>Read the full write-up</Link>
        </p>
      </div>
    </dialog>
  );
}
