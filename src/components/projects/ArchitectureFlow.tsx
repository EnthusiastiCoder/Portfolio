import type { Diagram } from "@/data/projects";

/** A down arrow drawn in SVG (no glyphs), sized by the text around it. */
function DownArrow() {
  return (
    <svg
      viewBox="0 0 12 24"
      width="0.75em"
      height="1.5em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="arch-flow-arrow"
    >
      <path d="M6 2v19M1.5 16.5 6 21l4.5-4.5" />
    </svg>
  );
}

/**
 * The same architecture as ArchitectureDiagram, laid out for narrow screens:
 * each component that sends something is a full-width box, and under it every
 * connection is an arrow with its label pointing at the box it reaches. Plain
 * HTML text, so it stays readable on a 390 px phone instead of shrinking.
 */
export default function ArchitectureFlow({
  diagram,
  title,
  className,
}: {
  diagram: Diagram;
  title: string;
  className?: string;
}) {
  const labels = new Map(diagram.nodes.map((n) => [n.id, n.label]));
  const sources = diagram.nodes.filter((n) => diagram.edges.some((e) => e.from === n.id));
  return (
    <ol className={`arch-flow ${className ?? ""}`} aria-label={`${title} architecture`}>
      {sources.map((node) => (
        <li key={node.id} className="arch-flow-group">
          <p className="arch-flow-node">{node.label}</p>
          <ul className="arch-flow-edges">
            {diagram.edges
              .filter((e) => e.from === node.id)
              .map((edge) => (
                <li key={`${edge.from}-${edge.to}`} className="arch-flow-edge">
                  <span className="arch-flow-link">
                    <DownArrow />
                    <span className="arch-flow-label">{edge.label ?? "connects to"}</span>
                  </span>
                  <span className="arch-flow-node arch-flow-node--to">
                    {labels.get(edge.to) ?? edge.to}
                  </span>
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
