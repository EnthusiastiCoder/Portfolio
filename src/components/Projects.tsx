import Link from "next/link";
import FeaturedRepos from "@/components/FeaturedRepos";
import SectionHeading from "@/components/SectionHeading";
import { formatMonth } from "@/lib/format";
import { getAllProjects } from "@/lib/projects";
import type { GitHubRepoSummary } from "@/lib/stats/types";

/** Project cards, featured first, then the most relevant public GitHub repos. */
export default function Projects({ repos }: { repos: GitHubRepoSummary[] }) {
  const all = getAllProjects();
  const ordered = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)];
  return (
    <section id="projects" aria-labelledby="projects-title" className="panel p-6 sm:p-8">
      <SectionHeading id="projects-title" command="cd ~/projects && ls" title="Projects" />
      <ul className="grid gap-4 md:grid-cols-2">
        {ordered.map((project) => (
          <li key={project.slug} className="term relative flex flex-col">
            <div className="term-bar" aria-hidden="true">
              {project.slug}
              {project.featured ? " · featured" : ""}
            </div>
            <div className="flex flex-1 flex-col p-5">
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
              <p className="mt-3 leading-relaxed">{project.summary}</p>
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
        ))}
      </ul>
      <FeaturedRepos repos={repos} />
    </section>
  );
}
