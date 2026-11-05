import Image from "next/image";
import SyncPlayArt from "@/components/SyncPlayArt";
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
