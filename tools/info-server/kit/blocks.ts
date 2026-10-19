// Building blocks for kit artifact pages. A builder imports these, composes a page and writes
// info-server/artifacts/<id>.html. Every number and coordinate is computed from data here.

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function page(o: { id: string; title: string; birdseye: string; modals: string[] }): string {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><link rel="stylesheet" href="/kit/kit.css"></head>
<body data-artifact="${esc(o.id)}">
<header class="kit-bar"><a class="kit-back" href="/">← Home</a><b>${esc(o.title)}</b>
<span class="dim small kit-standalone">Hover a dotted word for its meaning · click tiles for detail</span></header>
<main class="kit-page kit-birdseye">
${o.birdseye}
</main>
${o.modals.join("\n")}
<script src="/kit/kit.js"></script>
</body></html>`;
}

/** The answer block: at most 5 short lines, the first is the headline. */
export function answer(lines: string[]): string {
	if (lines.length > 5) throw new Error("bird's-eye answer: at most 5 lines");
	for (const l of lines) if (l.replace(/<[^>]+>/g, "").length > 110) throw new Error(`answer line too long: ${l}`);
	return `<div class="kit-answer">${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
}

export interface Tile {
	big: string;
	label: string;
	open?: string;
	tone?: "pass" | "partial" | "fail";
}
export function tiles(ts: Tile[]): string {
	return `<div class="kit-tiles">${ts
		.map((t) => {
			const inner = `<div class="big">${t.big}</div><div class="lbl">${t.label}</div>${t.open ? '<span class="kit-more">Details →</span>' : ""}`;
			const cls = `kit-tile${t.tone ? ` ${t.tone}` : ""}`;
			return t.open ? `<button class="${cls}" data-kit-open="${esc(t.open)}">${inner}</button>` : `<div class="${cls}">${inner}</div>`;
		})
		.join("")}</div>`;
}

/** A modal source. Must start with a visual; lead is at most 3 short lines. */
export function modal(id: string, title: string, visual: string, lead: string[], extra = ""): string {
	if (lead.length > 3) throw new Error(`modal ${id}: at most 3 lead lines`);
	return `<section class="kit-modal-src" id="m-${esc(id)}" data-title="${esc(title)}" hidden>
${visual}
<div class="kit-lead">${lead.map((l) => `<p>${l}</p>`).join("")}</div>
${extra}
</section>`;
}

export function visual(inner: string, caption?: string, legend?: Array<[string, string]>): string {
	const lg = legend?.length
		? `<div class="kit-legend">${legend.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("")}</div>`
		: "";
	return `<div class="kit-visual">${lg}${inner}${caption ? `<p class="kit-caption">${caption}</p>` : ""}</div>`;
}

/** Horizontal bars, widths proportional to value / max. */
export function bars(
	rows: Array<{ label: string; value: number; text?: string; tone?: "alt" | "pass" }>,
	max = Math.max(...rows.map((r) => r.value)),
): string {
	return `<div class="kit-bars">${rows
		.map(
			(r) =>
				`<div class="b"><span>${r.label}</span><div class="track"><div class="fill${r.tone ? ` ${r.tone}` : ""}" style="width:${max > 0 ? ((100 * Math.max(0, r.value)) / max).toFixed(1) : 0}%"></div></div><span class="v">${r.text ?? r.value}</span></div>`,
		)
		.join("")}</div>`;
}

/** A left-to-right flow of clickable boxes in rows (SVG), each box opens a modal. A second,
 * one-column copy is drawn for phones (CSS shows one of the two), so labels never shrink to dust. */
export function flow(rowsOfNodes: Array<Array<{ id: string; title: string; sub: string }>>, width?: number): string {
	// ~260 units per box: drawn in a ~1000px dialog or page, labels render at ≥ 13px.
	const w = width ?? 260 * Math.max(...rowsOfNodes.map((r) => r.length));
	const wide = flowSvg(rowsOfNodes, w, "kit-flow-wide");
	const narrow = flowSvg(rowsOfNodes.flat().map((n) => [n]), 300, "kit-flow-narrow", 26);
	return wide + narrow;
}

function flowSvg(
	rowsOfNodes: Array<Array<{ id: string; title: string; sub: string }>>,
	width: number,
	cls: string,
	ROW_GAP = 46,
): string {
	const BOX_H = 64;
	const GAP = 34;
	const out: string[] = [];
	const centers: Array<Array<{ x: number; y: number; w: number }>> = [];
	const arrow = `arr-${cls}`;
	rowsOfNodes.forEach((row, ri) => {
		const n = row.length;
		const w = (width - GAP * (n - 1)) / n;
		const y = ri * (BOX_H + ROW_GAP);
		centers.push(row.map((_, i) => ({ x: i * (w + GAP), y, w })));
		row.forEach((node, i) => {
			const c = centers[ri]![i]!;
			out.push(`<g class="kit-node" data-kit-open="${esc(node.id)}" tabindex="0" role="button" aria-label="${esc(node.title)}">
<rect x="${c.x.toFixed(1)}" y="${y}" width="${c.w.toFixed(1)}" height="${BOX_H}" rx="10"/>
<text x="${(c.x + c.w / 2).toFixed(1)}" y="${y + 27}" text-anchor="middle" font-size="16" font-weight="700">${esc(node.title)}</text>
<text class="muted" x="${(c.x + c.w / 2).toFixed(1)}" y="${y + 48}" text-anchor="middle" font-size="13">${esc(node.sub)}</text></g>`);
			if (i > 0) {
				const p = centers[ri]![i - 1]!;
				out.push(`<path class="edge" marker-end="url(#${arrow})" d="M${(p.x + p.w).toFixed(1)} ${y + BOX_H / 2} L${(c.x - 3).toFixed(1)} ${y + BOX_H / 2}"/>`);
			}
		});
		if (ri > 0) {
			// From the last box of the previous row down to the first box of this row.
			const prev = centers[ri - 1]!.at(-1)!;
			const first = centers[ri]![0]!;
			const y0 = prev.y + BOX_H;
			const mid = y0 + ROW_GAP / 2;
			out.push(`<path class="edge" marker-end="url(#${arrow})" d="M${(prev.x + prev.w / 2).toFixed(1)} ${y0} L${(prev.x + prev.w / 2).toFixed(1)} ${mid} L${(first.x + first.w / 2).toFixed(1)} ${mid} L${(first.x + first.w / 2).toFixed(1)} ${first.y - 3}"/>`);
		}
	});
	const h = rowsOfNodes.length * BOX_H + (rowsOfNodes.length - 1) * ROW_GAP + 4;
	return `<svg class="${cls}" viewBox="-2 -2 ${width + 4} ${h + 4}" role="img" aria-label="flow">
<defs><marker id="${arrow}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor" class="muted"/></marker></defs>
${out.join("\n")}</svg>`;
}

/** A paged grid of cards: kit.js fits as many as the screen holds (uniform heights) and pages the
 * rest, so a bird's-eye page never scrolls. Use it as the LAST block of the bird's-eye. */
export function pages(cards: string[], minWidth = 240): string {
	return `<div class="kit-pages" data-min-w="${minWidth}"><div class="kit-grid">${cards.join("")}</div></div>`;
}

/** A small decay curve: share kept after d days for a half-life (computed, not drawn by hand). */
export function decayCurve(halfLife: number, days = 42, w = 440, h = 150): string {
	const L = 52; // room for the 100% / 50% labels
	const pts: string[] = [];
	for (let d = 0; d <= days; d++) {
		const x = L + (d / days) * (w - L - 20);
		const y = 10 + (1 - 0.5 ** (d / halfLife)) * (h - 40);
		pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
	}
	const xAt = (d: number) => L + (d / days) * (w - L - 20);
	const ticks = [0, 14, 28, 42]
		.map((d) => `<text class="muted" x="${xAt(d).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="17">${d} d</text>`)
		.join("");
	const yHalf = 10 + 0.5 * (h - 40);
	// Drawn at its natural size (never blown up to fill a wide dialog), shrinking only to fit.
	return `<svg width="${w}" viewBox="0 0 ${w} ${h}" role="img" aria-label="decay curve">
<polyline points="${pts.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="3"/>
<line x1="${L}" x2="${w - 20}" y1="${yHalf}" y2="${yHalf}" stroke="var(--border)" stroke-dasharray="4 4"/>
<text class="muted" x="0" y="20" font-size="17">100%</text><text class="muted" x="0" y="${yHalf + 5}" font-size="17">50%</text>
<circle cx="${xAt(halfLife).toFixed(1)}" cy="${yHalf}" r="5" fill="var(--orange)"/>${ticks}</svg>`;
}
