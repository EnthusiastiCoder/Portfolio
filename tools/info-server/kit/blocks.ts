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
