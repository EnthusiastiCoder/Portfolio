import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import SyncPlayArt from "@/components/SyncPlayArt";
import ArchitectureDiagram from "@/components/projects/ArchitectureDiagram";
import type { Project } from "@/data/projects";
import { getPrimaryCta } from "@/lib/projects";

/** The product's first screenshot, or the SyncPlay illustration (it has no screenshot). */
export function ProductShot({
  project,
  sizes,
  className,
  priority = false,
}: {
  project: Project;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const shot = project.screenshots?.[0];
  if (shot) {
    return (
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes={sizes}
        loading={priority ? undefined : "lazy"}
        priority={priority}
        className={className}
      />
    );
  }
  if (project.slug === "syncplay") return <SyncPlayArt className={className} />;
  return null;
}

/** The primary button: the live product (or "Get SyncPlay"). Always the loudest control. */
export function PrimaryCta({ project, className }: { project: Project; className?: string }) {
  const cta = getPrimaryCta(project);
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`cta-primary ${className ?? ""}`}
    >
      {cta.label}
    </a>
  );
}

/** "Source code": deliberately small, secondary text. */
export function SourceLink({ project }: { project: Project }) {
  if (!project.repo) return null;
  return (
    <a href={project.repo} target="_blank" rel="noopener noreferrer" className="source-link">
      Source code
    </a>
  );
}

/** Broken-grid column spans: 7/5, 5/7, then a full row. */
const SPANS = ["bp-span-7", "bp-span-5", "bp-span-5", "bp-span-7", "bp-span-12"];

/**
 * RED: one product as an engineering blueprint. Screenshot and primary CTA
 * first, then the architecture diagram, the hard problems, sourced numbers as
 * big mono figures, the trade-offs table and the full stack. Cards enter from
 * alternating sides on a hard axis.
 */
export default function ProductCard({ project, index }: { project: Project; index: number }) {
  const code = `P-${String(index + 1).padStart(2, "0")}`;
  const tradeoffs = project.depth?.tradeoffs ?? [];
  return (
    <article
      data-show="red both"
      className={`bp-card ${SPANS[index % SPANS.length]}`}
      data-enter={index % 2 === 0 ? "left" : "right"}
      aria-labelledby={`bp-${project.slug}`}
      style={{ "--o": 2 * index + 1 } as CSSProperties}
    >
      <header className="bp-head">
        <div className="bp-thumb">
          <ProductShot project={project} sizes="(min-width: 768px) 240px, 40vw" />
        </div>
        <div className="bp-title">
          <p className="bp-code" aria-hidden="true">
            {code} / {project.slug}
          </p>
          <h3 id={`bp-${project.slug}`} className="bp-name">
            <Link href={`/projects/${project.slug}`}>{project.title}</Link>
          </h3>
          <p className="bp-summary">{project.summary}</p>
          <p className="bp-actions">
            <PrimaryCta project={project} />
            <SourceLink project={project} />
          </p>
        </div>
      </header>

      <div className="bp-diagram">
        <p className="bp-label">Architecture</p>
        <ArchitectureDiagram diagram={project.diagram} title={project.title} />
      </div>

      {project.perf.length > 0 ? (
        <dl className="bp-perf">
          {project.perf.map((fact) => (
            <div key={fact.label} className="bp-perf-item">
              <dt>{fact.label}</dt>
              <dd className="bp-figure">{fact.value}</dd>
              <dd className="bp-source">Source: {fact.source}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="bp-problems">
        <p className="bp-label">Hard problems</p>
        <ol>
          {project.hardProblems.map((hp, i) => (
            <li key={hp.problem}>
              <span className="bp-step" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="bp-problem">{hp.problem}</p>
                <p className="bp-approach">{hp.approach}</p>
                <p className="bp-source">Source: {hp.source}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {tradeoffs.length > 0 ? (
        <table className="bp-table">
          <caption className="bp-label">Trade-offs</caption>
          <thead>
            <tr>
              <th scope="col">Id</th>
              <th scope="col">Decision and its cost</th>
            </tr>
          </thead>
          <tbody>
            {tradeoffs.map((t, i) => (
              <tr key={t}>
                <td>{`T-${String(i + 1).padStart(2, "0")}`}</td>
                <td>{t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <ul className="bp-stack" aria-label={`${project.title} stack`}>
        {project.stack.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
    </article>
  );
}
