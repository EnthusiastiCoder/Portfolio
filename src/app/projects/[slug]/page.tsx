import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ModeOnly from "@/components/ModeOnly";
import ArchitectureDiagram from "@/components/projects/ArchitectureDiagram";
import { PrimaryCta, ProductShot, SourceLink } from "@/components/projects/ProductCard";
import { projects } from "@/data/projects";
import { formatMonth } from "@/lib/format";
import { formatSource, getProjectBySlug } from "@/lib/projects";

export const revalidate = 21600;
export const dynamicParams = false;

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return {};
  const url = `/projects/${project.slug}`;
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: project.title, description: project.summary },
    twitter: { card: "summary_large_image", title: project.title, description: project.summary },
  };
}

export default async function ProjectPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  const { default: Content } = await import(`@/content/projects/${project.slug}.mdx`);
  // The first screenshot already leads the page.
  const shots = (project.screenshots ?? []).slice(1);

  return (
    <main id="main" className="detail" data-motion="red">
      <p className="detail-back">
        <Link href="/#projects">Back to products</Link>
      </p>
      <article>
        {/* Product first: the screenshot (or SyncPlay's illustration) and the live button. */}
        <header className="detail-hero">
          <div className="detail-shot" data-enter="depth-in">
            <ProductShot project={project} sizes="(min-width: 1024px) 60vw, 100vw" priority />
          </div>
          <div className="detail-intro">
            <h1 className="detail-title">{project.title}</h1>
            <p className="detail-meta">
              {formatMonth(project.date)}
              {project.featured && " · Featured"}
            </p>
            <p className="detail-summary">{project.summary}</p>
            <p className="detail-actions">
              <PrimaryCta project={project} className="cta-primary--big" />
              <SourceLink project={project} />
            </p>
          </div>
        </header>

        {/* RED: a two-column blueprint. */}
        <ModeOnly modes={["red", "both"]} className="detail-blueprint">
          <div className="detail-col">
            <p className="bp-label">Architecture</p>
            <ArchitectureDiagram diagram={project.diagram} title={project.title} />
            {project.perf.length > 0 ? (
              <dl className="bp-perf">
                {project.perf.map((fact) => (
                  <div key={fact.label} className="bp-perf-item" data-enter="left">
                    <dt>{fact.label}</dt>
                    <dd className="bp-figure">{fact.value}</dd>
                    <dd className="bp-source">Source: {formatSource(fact.source)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <ul className="bp-stack" aria-label={`${project.title} stack`}>
              {project.stack.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </div>
          <div className="detail-col bp-problems">
            <p className="bp-label">Hard problems</p>
            <ol>
              {project.hardProblems.map((hp, i) => (
                <li key={hp.problem} data-enter="right" data-stagger={String(i + 1)}>
                  <span className="bp-step" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="bp-problem">{hp.problem}</p>
                    <p className="bp-approach">{hp.approach}</p>
                    <p className="bp-source">Source: {formatSource(hp.source)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </ModeOnly>

        {/* BLUE: the story, who it helps, design notes and a masked gallery. */}
        <ModeOnly modes={["blue", "both"]} className="detail-story">
          <p className="detail-story-lede" data-enter="depth-in">
            {project.story}
          </p>
          <div className="detail-story-grid">
            <div data-enter="left">
              <h2 className="detail-h2">Who it helps</h2>
              <p>{project.audience}</p>
            </div>
            <div data-enter="right" data-stagger="2">
              <h2 className="detail-h2">How it is designed</h2>
              <ul className="detail-design">
                {project.design.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
          {shots.length > 0 ? (
            <div className="detail-gallery">
              {shots.map((shot, i) => (
                <figure
                  key={shot.src}
                  className="masked-shot"
                  data-enter={i % 2 === 0 ? "depth-out" : "rotate"}
                >
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={shot.width}
                    height={shot.height}
                    sizes="100vw"
                    loading="lazy"
                    className="h-auto w-full"
                  />
                </figure>
              ))}
            </div>
          ) : null}
        </ModeOnly>

        <div className="prose-matrix detail-notes">
          <Content />
        </div>
      </article>
    </main>
  );
}
