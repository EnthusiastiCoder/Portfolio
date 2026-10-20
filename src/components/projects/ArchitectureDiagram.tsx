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

/** Edge-label metrics (10px sans): a generous average glyph width and line step. */
const LABEL_CHAR_W = 6;
const LABEL_LINE_H = 12;
const PAD = 4;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Seg = [number, number, number, number];

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Whether segment (x1,y1)-(x2,y2) passes through the box (Liang-Barsky clip). */
function segHitsBox([x1, y1, x2, y2]: Seg, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks: [number, number][] = [
    [-dx, x1 - b.x0],
    [dx, b.x1 - x1],
    [-dy, y1 - b.y0],
    [dy, b.y1 - y1],
  ];
  for (const [pp, q] of checks) {
    if (pp === 0) {
      if (q < 0) return false;
    } else {
      const r = q / pp;
      if (pp < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** Parameter along a->b where the segment leaves the box centred on a. */
function exitT(dx: number, dy: number, hw: number, hh: number): number {
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  return Math.min(tx, ty, 0.5);
}

/** Splits a label into two near-even lines on a space, when it has one. */
function splitLabel(label: string): string[] {
  const words = label.split(" ");
  if (words.length < 2) return [label];
  let best = [label];
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const w = Math.max(a.length, b.length);
    if (w < bestW) {
      bestW = w;
      best = [a, b];
    }
  }
  return best;
}

type PlacedLabel = { key: string; lines: string[]; cx: number; cy: number };

/**
 * Places every edge label on its visible stretch of edge (between the two
 * node boxes), nudged to one side of the line, choosing the spot that
 * overlaps no node, no other label and no edge, and stays on the board.
 */
function placeLabels(
  edges: {
    key: string;
    label: string;
    a: [number, number];
    ah: number;
    b: [number, number];
    bh: number;
  }[],
  nodeBoxes: Box[],
): PlacedLabel[] {
  const segs: Seg[] = edges.map((e) => [e.a[0], e.a[1], e.b[0], e.b[1]]);
  const placed: Box[] = [];
  const out: PlacedLabel[] = [];
  edges.forEach((e, idx) => {
    const [x1, y1] = e.a;
    const [x2, y2] = e.b;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ta = exitT(dx, dy, NODE_W / 2 + PAD, e.ah / 2 + PAD);
    const tb = 1 - exitT(dx, dy, NODE_W / 2 + PAD, e.bh / 2 + PAD);
    const nx = -dy / len;
    const ny = dx / len;
    let best: { score: number; lines: string[]; cx: number; cy: number; box: Box } | null = null;
    for (const lines of [[e.label], splitLabel(e.label)]) {
      const w = Math.max(...lines.map((l) => l.length)) * LABEL_CHAR_W + PAD;
      const h = lines.length * LABEL_LINE_H + 2;
      const clear = Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2) + 3;
      for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const t = ta + (tb - ta) * f;
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        for (const side of [-1, 1]) {
          for (const step of [0, 1, 2, 3, 4, 5, 6]) {
            const dist = clear + step * 6;
            const cx = px + nx * dist * side;
            const cy = py + ny * dist * side;
            const box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
            let score = 0;
            for (const nb of nodeBoxes) score += overlapArea(box, nb) * 4;
            for (const pb of placed) score += overlapArea(box, pb) * 4;
            segs.forEach((sg, j) => {
              if (segHitsBox(sg, box)) score += j === idx ? 2000 : 600;
            });
            const off =
              Math.max(0, -box.x0) +
              Math.max(0, box.x1 - W) +
              Math.max(0, -box.y0) +
              Math.max(0, box.y1 - H);
            score += off * 200;
            score += (lines.length > 1 ? 1 : 0) + step * 3;
            if (!best || score < best.score) best = { score, lines, cx, cy, box };
          }
        }
      }
    }
    if (best) {
      placed.push(best.box);
      out.push({ key: e.key, lines: best.lines, cx: best.cx, cy: best.cy });
    }
  });
  return out;
}

/** Node centre on the 640 x 380 board, from its 0-100 grid position. */
function centre(x: number, y: number): [number, number] {
  return [92 + (x / 100) * (W - 184), 40 + (y / 100) * (H - 80)];
}

/**
 * The product's architecture as an inline blueprint: nodes are rects with
 * labels, edges are straight lines, and edge labels sit on top in a free spot
 * beside their edge (placeLabels). Each edge is a line drawn from 0 along its
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
  const heightOf = (label: string) => 18 + wrap(label).length * LINE_H;
  const nodeBoxes: Box[] = [...nodes.values()].map((n) => {
    const h = heightOf(n.label);
    return {
      x0: n.c[0] - NODE_W / 2 - PAD,
      y0: n.c[1] - h / 2 - PAD,
      x1: n.c[0] + NODE_W / 2 + PAD,
      y1: n.c[1] + h / 2 + PAD,
    };
  });
  const labels = placeLabels(
    diagram.edges.flatMap((edge) => {
      const a = nodes.get(edge.from);
      const b = nodes.get(edge.to);
      if (!a || !b || !edge.label) return [];
      return [
        {
          key: `${edge.from}-${edge.to}`,
          label: edge.label,
          a: a.c,
          ah: heightOf(a.label),
          b: b.c,
          bh: heightOf(b.label),
        },
      ];
    }),
    nodeBoxes,
  );
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
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <g
                transform={`translate(${x1.toFixed(1)} ${y1.toFixed(1)}) rotate(${angle.toFixed(2)})`}
              >
                <line className="diagram-edge" x1={0} y1={0} x2={len.toFixed(1)} y2={0} />
              </g>
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
      <g className="diagram-labels">
        {labels.map((l) => (
          <text
            key={l.key}
            className="diagram-edge-label"
            x={l.cx.toFixed(1)}
            y={(l.cy - ((l.lines.length - 1) * LABEL_LINE_H) / 2 + 3.5).toFixed(1)}
          >
            {l.lines.map((line, i) => (
              <tspan key={i} x={l.cx.toFixed(1)} dy={i === 0 ? 0 : LABEL_LINE_H}>
                {line}
              </tspan>
            ))}
          </text>
        ))}
      </g>
    </svg>
  );
}
