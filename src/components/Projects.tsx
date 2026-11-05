import ProductDeck from "@/components/projects/ProductDeck";
import ProjectDetail from "@/components/projects/ProjectDetail";
import ProjectDetailController from "@/components/projects/ProjectDetailController";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import { getAllProjects } from "@/lib/projects";

/**
 * The 5 products, in showcase order, as a 3D deck of cards in a folder
 * (ProductDeck), the same in every mode: each card is one product's overview
 * beside a fan of 3 usage shots, and the number on it follows the mode (red
 * the measured impact, blue and green a user-facing figure). In every mode a
 * click on a product opens its full-screen detail view (the large
 * architecture, then the details), rendered here as closed dialogs.
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
        <ProductDeck projects={products} />
      </div>
      {products.map((project, i) => (
        <ProjectDetail key={project.slug} project={project} index={i} count={products.length} />
      ))}
      <ProjectDetailController />
    </section>
  );
}
