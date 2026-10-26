import ProductOverview from "@/components/projects/ProductOverview";
import type { Project } from "@/data/projects";

/**
 * RED and GREEN: one product per screen, as a short overview beside its
 * looping demo (ProductOverview). Red's number is a measured impact figure,
 * green's a number a user cares about. A click anywhere opens the detail view
 * (the large architecture and everything else).
 */
export default function ProjectScreens({ projects }: { projects: Project[] }) {
  return (
    <div data-show="red both" className="pjs">
      {projects.map((project, i) => (
        <article key={project.slug} className="pj ov" aria-labelledby={`pj-${project.slug}`}>
          <ProductOverview
            project={project}
            index={i}
            count={projects.length}
            headingId={`pj-${project.slug}`}
            figure="by-mode"
            enter
          />
        </article>
      ))}
    </div>
  );
}
