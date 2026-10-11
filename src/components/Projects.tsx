import Image from "next/image";
import Link from "next/link";
import FeaturedRepos from "@/components/FeaturedRepos";
import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import SyncPlayArt from "@/components/SyncPlayArt";
import type { Project } from "@/data/projects";
import { formatMonth } from "@/lib/format";
import { getAllProjects, getProjectLink } from "@/lib/projects";
import type { GitHubRepoSummary } from "@/lib/stats/types";

const CARD_SIZES = "(min-width: 768px) 50vw, 100vw";
const THUMB_SIZES = "96px";

function Shot({
  project,
  sizes,
  className,
}: {
  project: Project;
  sizes: string;
  className: string;
}) {
  const shot = project.screenshots?.[0];
  if (shot) {
    return (
      <div className="sd-shot">
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          sizes={sizes}
          loading="lazy"
          className={className}
        />
      </div>
    );
  }
  if (project.slug === "syncplay") {
    return (
      <div className="sd-shot">
        <SyncPlayArt className={className} />
      </div>
    );
  }
  return null;
}

function Availability({ slug }: { slug: string }) {
  const link = getProjectLink(slug);
  if (link.kind === "live") {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-10 text-xs"
      >
        Open project
      </a>
    );
  }
  return <span className="text-muted text-xs">{link.label}</span>;
}

/** Project cards, featured first, then the most relevant public GitHub repos. */
export default function Projects({ repos }: { repos: GitHubRepoSummary[] }) {
  const all = getAllProjects();
  const ordered = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)];
  return (
    <section id="projects" aria-labelledby="projects-title" className="panel p-6 sm:p-8">
      <SectionHeading id="projects-title" command="cd ~/projects && ls" title="Projects" />
      <ul className="grid gap-4 md:grid-cols-2">
        {ordered.map((project) => {
          const depth = project.depth;
          const detailed = Boolean(depth && project.tagline);
          return (
            <li key={project.slug} className="term relative flex flex-col">
              <div className="term-bar" aria-hidden="true">
                {project.slug}
                {project.featured ? " · featured" : ""}
              </div>
              <div className="flex flex-1 flex-col p-5">
                {detailed ? (
                  <>
                    <ModeOnly modes={["blue"]}>
                      <Shot
                        project={project}
                        sizes={CARD_SIZES}
                        className="mb-4 h-auto w-full rounded"
                      />
                    </ModeOnly>
                    <ModeOnly modes={["both"]}>
                      <Shot
                        project={project}
                        sizes={CARD_SIZES}
                        className="mb-4 h-auto w-full rounded"
                      />
                    </ModeOnly>
                  </>
                ) : null}
                <h3 className="text-lg font-bold">
                  {/* The ::after overlay makes the whole card clickable with one link. */}
                  <Link href={`/projects/${project.slug}`} className="text-accent card-link">
                    {project.title}
                  </Link>
                </h3>
                <p className="text-muted mt-1 text-xs">
                  {formatMonth(project.date)}
                  {project.featured && <span className="text-accent"> · Featured</span>}
                </p>

                {detailed && depth ? (
                  <>
                    <ModeOnly modes={["red"]}>
                      <div className="mt-3 flex gap-3">
                        <div className="w-24 shrink-0">
                          <Shot
                            project={project}
                            sizes={THUMB_SIZES}
                            className="h-auto w-full rounded"
                          />
                        </div>
                        <p className="leading-relaxed">{project.summary}</p>
                      </div>
                      <h4 className="text-accent mt-3 text-sm font-bold">Architecture</h4>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {depth.architecture.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <h4 className="text-accent mt-3 text-sm font-bold">Trade-offs</h4>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {depth.tradeoffs.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <h4 className="text-accent mt-3 text-sm font-bold">Facts</h4>
                      <dl className="mt-1 space-y-1 text-sm">
                        {depth.facts.map((fact) => (
                          <div key={fact.label}>
                            <dt className="inline font-bold">{fact.label}: </dt>
                            <dd className="inline">
                              {fact.detail}
                              <span className="text-muted block text-xs">Source: {fact.source}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </ModeOnly>
                    <ModeOnly modes={["blue"]}>
                      <p className="mt-3 leading-relaxed">{project.tagline}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {(project.highlights ?? []).slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </ModeOnly>
                    <ModeOnly modes={["both"]}>
                      <p className="mt-3 leading-relaxed">{project.tagline}</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {depth.facts.slice(0, 2).map((fact) => (
                          <li key={fact.label}>
                            <span className="font-bold">{fact.label}: </span>
                            {fact.detail}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm">
                        <span className="text-accent">Engineering notes</span>
                        <span aria-hidden="true"> →</span>
                      </p>
                    </ModeOnly>
                  </>
                ) : (
                  <p className="mt-3 leading-relaxed">{project.summary}</p>
                )}

                <p className="mt-3">
                  <Availability slug={project.slug} />
                </p>
                <ul className="mt-auto flex flex-wrap gap-2 pt-4 text-xs" aria-label="Tech stack">
                  {project.tech.map((tech) => (
                    <li
                      key={tech}
                      className="border-accent-dim/50 text-muted rounded border px-2 py-0.5"
                    >
                      {tech}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
      <FeaturedRepos repos={repos} />
    </section>
  );
}
