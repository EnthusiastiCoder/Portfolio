import type { Diagram } from "@/data/projects";

const W = 640;
const H = 380;
const NODE_W = 156;
const LINE_H = 13;
const MAX_CHARS = 22;

/** Splits a label into lines of at most MAX_CHARS, on spaces. */
function wrap(label: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of label.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > MAX_CHARS && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Node centre on the 640 x 380 board, from its 0-100 grid position. */
function centre(x: number, y: number): [number, number] {
  return [92 + (x / 100) * (W - 184), 40 + (y / 100) * (H - 80)];
}

/**
 * The product's architecture as an inline blueprint: nodes are rects with mono
 * labels, edges are straight lines. Each edge is a line drawn from 0 along its
 * own axis, so the scroll reveal can grow it with scaleX (transform only).
 */
export default function ArchitectureDiagram({
  diagram,
  title,
  className,
}: {
  diagram: Diagram;
  title: string;
  className?: string;
}) {
  const nodes = new Map(diagram.nodes.map((n) => [n.id, { ...n, c: centre(n.x, n.y) }]));
  const titleId = `diagram-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <svg
      data-diagram=""
      role="img"
      aria-labelledby={titleId}
      viewBox={`0 0 ${W} ${H}`}
      className={`diagram ${className ?? ""}`}
    >
      <title id={titleId}>
        {`${title} architecture: ${diagram.nodes.map((n) => n.label).join(", ")}`}
      </title>
      <g className="diagram-edges">
        {diagram.edges.map((edge) => {
          const a = nodes.get(edge.from);
          const b = nodes.get(edge.to);
          if (!a || !b) return null;
          const [x1, y1] = a.c;
          const [x2, y2] = b.c;
          const len = Math.hypot(x2 - x1, y2 - y1);
          const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
          const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <g
                transform={`translate(${x1.toFixed(1)} ${y1.toFixed(1)}) rotate(${angle.toFixed(2)})`}
              >
                <line className="diagram-edge" x1={0} y1={0} x2={len.toFixed(1)} y2={0} />
              </g>
              {edge.label ? (
                <text className="diagram-edge-label" x={mx.toFixed(1)} y={(my - 5).toFixed(1)}>
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
      <g className="diagram-nodes">
        {[...nodes.values()].map((node) => {
          const lines = wrap(node.label);
          const h = 18 + lines.length * LINE_H;
          const [cx, cy] = node.c;
          return (
            <g key={node.id} className="diagram-node">
              <rect
                x={(cx - NODE_W / 2).toFixed(1)}
                y={(cy - h / 2).toFixed(1)}
                width={NODE_W}
                height={h}
                rx={2}
              />
              <text x={cx.toFixed(1)} y={(cy - h / 2 + 9 + LINE_H - 3).toFixed(1)}>
                {lines.map((line, i) => (
                  <tspan key={i} x={cx.toFixed(1)} dy={i === 0 ? 0 : LINE_H}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
