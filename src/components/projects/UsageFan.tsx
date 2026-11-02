import Image from "next/image";
import type { CSSProperties } from "react";
import type { Project } from "@/data/projects";

/**
 * A product's 3 usage shots as a hinged fan. The three cards share one box,
 * so they pivot on one shared hinge (globals.css sets the transform-origin:
 * below the cards on desktops, left of them on phones); each one's --k (-1, 0,
 * 1) sets its angle. scroll.css opens the fan as the card arrives, and hover
 * spreads it further. The last step (the result) is on top.
 */
export default function UsageFan({ project }: { project: Project }) {
  return (
    <div data-fan="" className="ov-fan">
      {project.usage.map((shot, n) => (
        <figure
          key={shot.src}
          data-fan-card=""
          className="fan-card"
          style={{ "--k": n - 1 } as CSSProperties}
        >
          <Image
            src={shot.src}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            sizes="(min-width: 900px) 1080px, (min-resolution: 2dppx) 90vw, 1000px"
            loading="lazy"
          />
          <figcaption className="fan-step">
            {String(n + 1).padStart(2, "0")} {shot.step}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
