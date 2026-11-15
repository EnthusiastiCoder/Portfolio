import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExternalLink from "@/components/ExternalLink";
import { projects } from "@/data/projects";
import { formatMonth } from "@/lib/format";
import { getProjectBySlug } from "@/lib/projects";

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

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <p className="text-sm">
        <Link href="/#projects">
          <span aria-hidden="true">cd ../ </span>Back to projects
        </Link>
      </p>
      <article className="panel mt-6 p-6 sm:p-10">
        <header>
          <p className="prompt text-sm" aria-hidden="true">
            cat {project.slug}.md
          </p>
          <h1 className="text-accent text-glow mt-2 text-3xl font-bold sm:text-4xl">
            {project.title}
          </h1>
          <p className="text-muted mt-2 text-sm">
            {formatMonth(project.date)}
            {project.featured && " · Featured"}
          </p>
          <p className="mt-4 text-lg leading-relaxed">{project.summary}</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="Tech stack">
            {project.tech.map((tech) => (
              <li key={tech} className="border-accent-dim/50 text-muted rounded border px-2 py-0.5">
                {tech}
              </li>
            ))}
          </ul>
          {(project.repo || project.demo) && (
            <p className="mt-4 flex flex-wrap gap-4 text-sm">
              {project.repo && <ExternalLink href={project.repo}>Source code</ExternalLink>}
              {project.demo && <ExternalLink href={project.demo}>Live demo</ExternalLink>}
            </p>
          )}
        </header>
        <div className="prose-matrix border-accent-dim/40 mt-8 border-t pt-2">
          <Content />
        </div>
      </article>
    </main>
  );
}
