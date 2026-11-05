import type { Diagram } from "@/data/projects";

const W = 640;
const H = 380;
const NODE_W = 140;
const LINE_H = 13;
const MAX_CHARS = 20;

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
/** Margin around the drawn content in the cropped viewBox. */
const VIEW_PAD = 6;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Seg = [number, number, number, number];
type Pt = [number, number];

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

function grow(b: Box, by: number): Box {
  return { x0: b.x0 - by, y0: b.y0 - by, x1: b.x1 + by, y1: b.y1 + by };
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

/** Whether segments p1-p2 and p3-p4 properly cross. */
function segsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return d(p3, p4, p1) * d(p3, p4, p2) < 0 && d(p1, p2, p3) * d(p1, p2, p4) < 0;
}

/** Whether two axis-aligned segments run alongside each other closer than 8px. */
function segsHug(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const spanOverlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(Math.max(a0, a1), Math.max(b0, b1)) > Math.max(Math.min(a0, a1), Math.min(b0, b1));
  if (p1[1] === p2[1] && p3[1] === p4[1] && Math.abs(p1[1] - p3[1]) < 8) {
    return spanOverlap(p1[0], p2[0], p3[0], p4[0]);
  }
  if (p1[0] === p2[0] && p3[0] === p4[0] && Math.abs(p1[0] - p3[0]) < 8) {
    return spanOverlap(p1[1], p2[1], p3[1], p4[1]);
  }
  return false;
}

function inside(p: Pt, b: Box): boolean {
  return p[0] > b.x0 && p[0] < b.x1 && p[1] > b.y0 && p[1] < b.y1;
}

/** The point where the ray from `from` (inside box b) towards `to` leaves b. */
function leave(from: Pt, to: Pt, b: Box): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  let t = 1;
  if (dx > 0) t = Math.min(t, (b.x1 - from[0]) / dx);
  if (dx < 0) t = Math.min(t, (b.x0 - from[0]) / dx);
  if (dy > 0) t = Math.min(t, (b.y1 - from[1]) / dy);
  if (dy < 0) t = Math.min(t, (b.y0 - from[1]) / dy);
  return [from[0] + dx * t, from[1] + dy * t];
}

/** A routed edge: its visible polyline, clipped to the two node borders. */
type Route = { key: string; pts: Pt[] };

/**
 * Routes every edge so it crosses no node box: a straight line when that is
 * clear, otherwise an L or a Z of right angles through the gaps between
 * nodes. Among clear routes it prefers short ones with few bends that cross
 * and hug no earlier edge. Each route is clipped to the borders of its two
 * nodes, so no line is ever drawn inside a box.
 */
function routeEdges(
  edges: { key: string; from: string; to: string; a: Pt; b: Pt }[],
  rects: Map<string, Box>,
): Route[] {
  const done: Pt[][] = [];
  const steps: number[] = [];
  for (let v = 12; v <= W - 12; v += 6) steps.push(v);
  return edges.map((e) => {
    const [ax, ay] = e.a;
    const [bx, by] = e.b;
    const ra = rects.get(e.from)!;
    const rb = rects.get(e.to)!;
    const candidates: Pt[][] = [
      [e.a, e.b],
      [e.a, [bx, ay], e.b],
      [e.a, [ax, by], e.b],
    ];
    for (const m of steps) {
      candidates.push([e.a, [m, ay], [m, by], e.b]);
      if (m <= H - 12) candidates.push([e.a, [ax, m], [bx, m], e.b]);
    }
    let best: { cost: number; pts: Pt[] } | null = null;
    for (const raw of candidates) {
      const pts = raw.filter((p, i) => i === 0 || p[0] !== raw[i - 1][0] || p[1] !== raw[i - 1][1]);
      const bends = pts.slice(1, -1);
      // Every bend sits outside both end boxes, with room to read as a corner.
      if (bends.some((p) => inside(p, grow(ra, PAD + 6)) || inside(p, grow(rb, PAD + 6)))) {
        continue;
      }
      const vis: Pt[] = [...pts];
      vis[0] = leave(pts[0], pts[1], ra);
      vis[vis.length - 1] = leave(pts[pts.length - 1], pts[pts.length - 2], rb);
      let cost = bends.length * 60;
      for (let i = 0; i < vis.length - 1; i++) {
        const seg: Seg = [vis[i][0], vis[i][1], vis[i + 1][0], vis[i + 1][1]];
        cost += Math.hypot(seg[2] - seg[0], seg[3] - seg[1]);
        for (const [id, r] of rects) {
          const own = id === e.from || id === e.to;
          const first = i === 0;
          const last = i === vis.length - 2;
          // The end segments touch their own box by design; nothing else may.
          if (own && (id === e.from ? first : last)) continue;
          if (segHitsBox(seg, grow(r, own ? PAD : PAD + 4))) cost += 100000;
        }
        for (const other of done) {
          for (let j = 0; j < other.length - 1; j++) {
            if (segsCross(vis[i], vis[i + 1], other[j], other[j + 1])) cost += 400;
            if (segsHug(vis[i], vis[i + 1], other[j], other[j + 1])) cost += 2000;
          }
        }
      }
      if (!best || cost < best.cost) best = { cost, pts: vis };
    }
    const pts = best ? best.pts : [e.a, e.b];
    done.push(pts);
    return { key: e.key, pts };
  });
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

type PlacedLabel = { key: string; lines: string[]; box: Box };

/**
 * Places every edge label beside one visible segment of its routed edge,
 * nudged to one side of the line, choosing the spot that overlaps no node,
 * no other label and no edge, and stays on the board.
 */
function placeLabels(
  edges: { key: string; label: string }[],
  routes: Route[],
  nodeBoxes: Box[],
): PlacedLabel[] {
  const segs = routes.flatMap((r) =>
    r.pts.slice(1).map((p, i) => ({
      key: r.key,
      seg: [r.pts[i][0], r.pts[i][1], p[0], p[1]] as Seg,
    })),
  );
  const placed: Box[] = [];
  const out: PlacedLabel[] = [];
  for (const e of edges) {
    let best: { score: number; lines: string[]; box: Box } | null = null;
    for (const { seg } of segs.filter((s) => s.key === e.key)) {
      const [x1, y1, x2, y2] = seg;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (const lines of [[e.label], splitLabel(e.label)]) {
        const w = Math.max(...lines.map((l) => l.length)) * LABEL_CHAR_W + PAD;
        const h = lines.length * LABEL_LINE_H + 2;
        const clear = Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2) + 3;
        for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          const px = x1 + dx * f;
          const py = y1 + dy * f;
          for (const side of [-1, 1]) {
            for (const step of [0, 1, 2, 3, 4, 5, 6]) {
              const dist = clear + step * 6;
              const cx = px + nx * dist * side;
              const cy = py + ny * dist * side;
              const box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
              let score = 0;
              for (const nb of nodeBoxes) score += overlapArea(box, nb) * 4;
              for (const pb of placed) score += overlapArea(box, pb) * 4;
              for (const s of segs) {
                if (segHitsBox(s.seg, box)) score += s.key === e.key ? 2000 : 600;
              }
              const off =
                Math.max(0, -box.x0) +
                Math.max(0, box.x1 - W) +
                Math.max(0, -box.y0) +
                Math.max(0, box.y1 - H);
              score += off * 200;
              // Prefer longer segments, where a label reads as belonging to its edge.
              score += (lines.length > 1 ? 1 : 0) + step * 3 + Math.max(0, 80 - len);
              if (!best || score < best.score) best = { score, lines, box };
            }
          }
        }
      }
    }
    if (best) {
      placed.push(best.box);
      out.push({ key: e.key, lines: best.lines, box: best.box });
    }
  }
  return out;
}

/** Node centre on the 640 x 380 board, from its 0-100 grid position. */
function centre(x: number, y: number): Pt {
  return [92 + (x / 100) * (W - 184), 40 + (y / 100) * (H - 80)];
}

/**
 * The product's architecture as an inline blueprint: nodes are rects with
 * labels, edges are routed around every node box (routeEdges), and edge
 * labels sit on a plate in the panel colour in a free spot beside their edge
 * (placeLabels). Each edge segment is a line drawn from 0 along its own axis,
 * so the scroll reveal can grow it with scaleX (transform only).
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
  const rects = new Map<string, Box>(
    [...nodes.values()].map((n) => {
      const h = heightOf(n.label);
      return [
        n.id,
        {
          x0: n.c[0] - NODE_W / 2,
          y0: n.c[1] - h / 2,
          x1: n.c[0] + NODE_W / 2,
          y1: n.c[1] + h / 2,
        },
      ];
    }),
  );
  const nodeBoxes = [...rects.values()].map((r) => grow(r, PAD));
  const edges = diagram.edges.flatMap((edge) => {
    const a = nodes.get(edge.from);
    const b = nodes.get(edge.to);
    if (!a || !b) return [];
    return [{ key: `${edge.from}-${edge.to}`, from: edge.from, to: edge.to, a: a.c, b: b.c }];
  });
  const routes = routeEdges(edges, rects);
  const labels = placeLabels(
    diagram.edges.flatMap((edge) =>
      edge.label ? [{ key: `${edge.from}-${edge.to}`, label: edge.label }] : [],
    ),
    routes,
    nodeBoxes,
  );
  // Crop the board to what is drawn, so no empty band sits above or below the
  // boxes (the 0-100 grid rarely uses its full height).
  const drawn = [
    ...rects.values(),
    ...labels.map((l) => l.box),
    ...routes.flatMap((r) => r.pts.map(([x, y]) => ({ x0: x, y0: y, x1: x, y1: y }))),
  ];
  const view = grow(
    {
      x0: Math.min(...drawn.map((b) => b.x0)),
      y0: Math.min(...drawn.map((b) => b.y0)),
      x1: Math.max(...drawn.map((b) => b.x1)),
      y1: Math.max(...drawn.map((b) => b.y1)),
    },
    VIEW_PAD,
  );
  return (
    <svg
      data-diagram=""
      role="img"
      aria-labelledby={titleId}
      viewBox={`${view.x0.toFixed(1)} ${view.y0.toFixed(1)} ${(view.x1 - view.x0).toFixed(1)} ${(view.y1 - view.y0).toFixed(1)}`}
      className={`diagram ${className ?? ""}`}
    >
      <title id={titleId}>
        {`${title} architecture: ${diagram.nodes.map((n) => n.label).join(", ")}`}
      </title>
      <g className="diagram-edges">
        {routes.map((route) => (
          <g key={route.key}>
            {route.pts.slice(1).map(([x2, y2], i) => {
              const [x1, y1] = route.pts[i];
              const len = Math.hypot(x2 - x1, y2 - y1);
              const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
              return (
                <g
                  key={i}
                  transform={`translate(${x1.toFixed(1)} ${y1.toFixed(1)}) rotate(${angle.toFixed(2)})`}
                >
                  <line className="diagram-edge" x1={0} y1={0} x2={len.toFixed(1)} y2={0} />
                </g>
              );
            })}
          </g>
        ))}
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
        {labels.map(({ key, lines, box }) => {
          const cx = (box.x0 + box.x1) / 2;
          const cy = (box.y0 + box.y1) / 2;
          return (
            <g key={key}>
              <rect
                className="diagram-edge-plate"
                x={box.x0.toFixed(1)}
                y={box.y0.toFixed(1)}
                width={(box.x1 - box.x0).toFixed(1)}
                height={(box.y1 - box.y0).toFixed(1)}
                rx={2}
              />
              <text
                className="diagram-edge-label"
                x={cx.toFixed(1)}
                y={(cy - ((lines.length - 1) * LABEL_LINE_H) / 2 + 3.5).toFixed(1)}
              >
                {lines.map((line, i) => (
                  <tspan key={i} x={cx.toFixed(1)} dy={i === 0 ? 0 : LABEL_LINE_H}>
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
