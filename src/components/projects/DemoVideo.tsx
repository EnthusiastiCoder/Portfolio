import { existsSync } from "node:fs";
import path from "node:path";
import DemoPlayer from "@/components/projects/DemoPlayer";
import { ProductShot } from "@/components/projects/ProductCard";
import type { Project } from "@/data/projects";

/** A product's recorded demo, if both files exist under public/projects/<slug>/. */
export function findDemo(slug: string): { src: string; poster: string } | null {
  const dir = path.join(process.cwd(), "public", "projects", slug);
  if (!existsSync(path.join(dir, "demo.webm")) || !existsSync(path.join(dir, "demo-poster.png"))) {
    return null;
  }
  return { src: `/projects/${slug}/demo.webm`, poster: `/projects/${slug}/demo-poster.png` };
}

/** What the frame's address bar reads: the live site's host, or the app's name. */
export function frameLabel(project: Project): string {
  try {
    const url = new URL(project.primaryCta.href);
    if (url.hostname === "github.com") return `${project.title} desktop app`;
    return url.hostname;
  } catch {
    return project.title;
  }
}

/**
 * The overview's visual: the product in a Matrix-styled browser frame that
 * fills its column. It plays the recorded looping demo when
 * public/projects/<slug>/demo.webm and demo-poster.png exist (checked at
 * build time), else it shows the product's screenshot. The video never
 * counts toward first load: it is a lazy <video>, and only DemoPlayer's few
 * lines of JS ship.
 */
export default function DemoVideo({
  project,
  sizes,
  className,
  enter = false,
}: {
  project: Project;
  sizes: string;
  className?: string;
  /** Fly in from depth on scroll (scroll.css). */
  enter?: boolean;
}) {
  const demo = findDemo(project.slug);
  return (
    <figure
      className={`demo ${className ?? ""}`}
      data-demo={demo ? "video" : "still"}
      data-enter={enter ? "depth-in" : undefined}
    >
      <div className="demo-bar" aria-hidden="true">
        <span className="demo-dots">
          <span />
          <span />
          <span />
        </span>
        <span className="demo-url">{frameLabel(project)}</span>
      </div>
      <div className="demo-screen">
        {demo ? (
          <DemoPlayer
            src={demo.src}
            poster={demo.poster}
            label={`${project.title} in use: a short looping demo`}
            className="demo-media"
          />
        ) : (
          <ProductShot project={project} sizes={sizes} className="demo-media" />
        )}
      </div>
    </figure>
  );
}
