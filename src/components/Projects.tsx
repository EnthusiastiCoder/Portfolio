import ProductCard from "@/components/projects/ProductCard";
import ProductStage from "@/components/projects/ProductStage";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import { getAllProjects } from "@/lib/projects";

/**
 * The 5 products, in showcase order, in three structurally different layouts:
 * RED a blueprint broken grid (diagram, hard problems, numbers, trade-offs),
 * BLUE the pinned depth-swap stage (big screenshot, story, who it helps),
 * BOTH each product's blue layer followed by its red blueprint card (CSS
 * flattens both containers and interleaves them with `order`).
 */
export default function Projects() {
  const products = getAllProjects();
  return (
    <section
      id="projects"
      aria-labelledby="projects-title"
      className="sect sect--projects"
      data-motion="blue"
    >
      <SectionWord align="right">Products</SectionWord>
      <div className="sect-inner">
        <SectionHeading id="projects-title" command="ls ~/products --long" title="Projects" />
      </div>
      <div className="projects-flow">
        <div data-show="red both" className="blueprint">
          <div className="blueprint-bg" aria-hidden="true" />
          <div className="blueprint-grid">
            {products.map((project, i) => (
              <ProductCard key={project.slug} project={project} index={i} />
            ))}
          </div>
        </div>
        <ProductStage projects={products} />
      </div>
    </section>
  );
}
