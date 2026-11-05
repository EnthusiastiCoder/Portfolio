// Builds artifacts/info-check.html from the visual check's results (called by visual-check.ts).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CONTENT } from "./server";
import type { Result } from "./visual-check";
import { answer, esc, gallery, modal, page, pages, tiles, visual } from "./kit/blocks";

const SHOTS = join(CONTENT, "artifacts", "visual-check");
/** What a screenshot's file name says it shows: home--library--hover.png → "library · hover". */
const captionOf = (id: string, file: string) => {
	const rest = file.slice(id.length, -4).replace(/^--/, "");
	if (!rest) return "The page";
	return rest
		.split("--")
		.map((p) => (p.startsWith("m-") ? `modal ${p.slice(2)}` : p))
		.join(" · ");
};
/** Every screenshot of page `id`: <id>.png first, then <id>--*.png (an exact prefix, so "home" never
 * picks up "home-x"). The page's own shot is listed even before it exists (info-check's is taken last). */
function shotsOf(id: string): Array<{ src: string; caption: string }> {
	const files = existsSync(SHOTS) ? readdirSync(SHOTS).filter((f) => f.startsWith(`${id}--`) && f.endsWith(".png")).sort() : [];
	return [`${id}.png`, ...files].map((f) => ({ src: `visual-check/${f}`, caption: captionOf(id, f) }));
}

export async function buildCheckPage(results: Result[], at: Date): Promise<void> {
	const pass = results.filter((r) => r.ok).length;
	const fail = results.length - pass;
	const when = at.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
	// Failures first, so a problem is never on page 2.
	const ordered = [...results].sort((x, y) => Number(x.ok) - Number(y.ok));
	const cards = ordered.map(
		(r) => `<button class="kit-card ${r.ok ? "pass" : "fail"}" data-kit-open="${esc(r.id)}">
			<img class="kit-thumb" src="visual-check/${esc(r.id)}.png" alt="">
			<span class="t">${r.ok ? "✓" : "✗"} ${esc(r.title)}</span>
			<span class="lbl dim small">${r.kind === "kit" ? "new format" : r.kind === "legacy" ? "older format" : "home"} · ${r.checks.filter((c) => c.ok).length}/${r.checks.length} checks</span></button>`,
	);
	const birdseye = [
		answer([
			// Pages checked = the home page + every registered artifact (this result page is one of them).
			fail === 0
				? `All <b>${results.length}</b> pages pass: home + the ${results.length - 1} artifacts, in a real browser.`
				: `<b>${fail}</b> of ${results.length} pages (home + ${results.length - 1} artifacts) fail the visual check.`,
			`Checked ${when}: screenshot + what a person would see on each page.`,
		]),
		tiles([
			{ big: String(pass), label: "pass", tone: "pass" },
			{ big: String(fail), label: "fail", tone: fail ? "fail" : "pass" },
			{ big: String(results.filter((r) => r.kind === "kit").length), label: "new-format pages (all modals opened)" },
		]),
		pages(cards, 230),
	].join("\n");
	const modals = results.map((r) => {
		const failed = r.checks.filter((c) => !c.ok);
		const rows = [...failed, ...r.checks.filter((c) => c.ok)];
		return modal(
			r.id,
			`${r.ok ? "✓" : "✗"} ${r.title}`,
			visual(gallery(shotsOf(r.id)), "Screenshots on Arpan's screen (1529×837 at 125%): click one to zoom, ← / → for the next."),
			[
				`${failed.length ? `<b>${failed.length}</b> of ${r.checks.length} checks fail (listed first).` : `All ${r.checks.length} checks pass.`}${r.id === "home" || r.id === "info-check" ? "" : ` <a href="/view/${esc(r.id)}">Open it →</a>`}`,
			],
			`<table class="kit-table"><tr><th></th><th>Check</th><th>What was seen</th></tr>${rows
				.map((c) => `<tr><td>${c.ok ? "✓" : "✗"}</td><td>${esc(c.name)}</td><td>${esc(c.detail)}</td></tr>`)
				.join("")}</table>`,
		);
	});
	await Bun.write(
		join(CONTENT, "artifacts", "info-check.html"),
		page({ id: "info-check", title: "Info server: visual check", birdseye, modals }),
	);
}
