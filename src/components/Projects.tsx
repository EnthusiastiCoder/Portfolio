import ProductStage from "@/components/projects/ProductStage";
import ProjectDetail from "@/components/projects/ProjectDetail";
import ProjectDetailController from "@/components/projects/ProjectDetailController";
import ProjectScreens from "@/components/projects/ProjectScreens";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import { getAllProjects } from "@/lib/projects";

/**
 * The 5 products, in showcase order, one per screen as an overview:
 * RED and GREEN share the overview screens (red adds the measured impact and
 * the skills, green adds who each product helps), BLUE keeps the pinned
 * depth-swap stage. In every mode a click on a product opens its full-screen
 * detail view (the large architecture, then the details), rendered here as
 * closed dialogs.
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
        <ProjectScreens projects={products} />
        <ProductStage projects={products} />
      </div>
      {products.map((project, i) => (
        <ProjectDetail key={project.slug} project={project} index={i} count={products.length} />
      ))}
      <ProjectDetailController />
    </section>
  );
}
