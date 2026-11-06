// VISUAL check of the info server: opens every deliverable in a real (headless) browser and
// checks what a person would SEE — not just that files exist (that is check.ts).
// Run: bun tools/info-server/visual-check.ts      (server must be up; exit 1 on any failure)
//
// Viewports: PRIMARY is Arpan's real screen (1529×837 CSS px at 125% scaling); every check runs
// there first, then at 1280×720, 1440×900, 1920×1080, and a 412-wide phone.
//
//   home     no page scroll, every artifact reachable in the paged library
//   kit      the answer is on the first screen, an illustration is drawn, terms are marked, a hover
//            shows a definition, an underlined word opens a stacked modal, EVERY modal opens with a
//            drawn visual and fits on screen
//   legacy   the framed page loads and shows real content
//
//   layout   on every page, at every size, and inside every modal (see AUDIT below):
//            no page scroll on a bird's-eye page (desktop) · no sideways scroll · nothing clipped by
//            overflow:hidden · no text cut by an ellipsis or line clamp · every SVG label inside its
//            viewBox and inside its box · no overlapping cards/labels · no wasted screen (empty space)
//
// Writes screenshots to content/artifacts/visual-check/<id>.png and
// the result page content/artifacts/info-check.html (registered as "info-check").
import { mkdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTENT, port } from "./server";

const BASE = `http://localhost:${port()}`; // from the port registry
const SHOTS = join(CONTENT, "artifacts", "visual-check");
const BROWSER =
	process.env["BROWSER_EXE"] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
/** A fresh debugging port per run, so a browser left over from a crashed run never blocks this one. */
const DEBUG_PORT = 9300 + Math.floor(Math.random() * 90);

interface Viewport {
	w: number;
	h: number;
	dpr: number;
	mobile?: boolean;
	/** A real browser window of this inner size (no emulation), as Arpan's screen is. */
	window?: boolean;
	label: string;
}
/** Arpan's screen: 1920×1200 at 125% → 1536×960 CSS; a maximised browser leaves 1529×837. */
// It is checked in a REAL window at 125% (Edge rounds it to 1530×838), with real scrollbars: an
// emulated viewport with hidden scrollbars once passed a page that scrolled 60px on his screen,
// because his 15px scrollbar narrowed the page, a tile wrapped to a new row, and the page grew.
const PRIMARY: Viewport = { w: 1529, h: 837, dpr: 1.25, window: true, label: "1529×837 @1.25 (Arpan's screen, real window)" };
const DESKTOP: Viewport[] = [
	PRIMARY,
	{ w: 1280, h: 720, dpr: 1, label: "1280×720" },
	{ w: 1440, h: 900, dpr: 1, label: "1440×900" },
	{ w: 1920, h: 1080, dpr: 1, label: "1920×1080" },
];
const PHONE: Viewport = { w: 412, h: 915, dpr: 1, mobile: true, label: "phone 412×915" };
/** A bird's-eye page must use at least this share of the screen below its top bar. */
const MIN_USED = 0.7;
/** Smallest readable text in a drawing, in CSS px as rendered (after the SVG is scaled). */
const MIN_TEXT_PX = 12;

// ── a minimal Chrome DevTools Protocol client ───────────────────────────────
class Cdp {
	private id = 0;
	private pending = new Map<number, (v: any) => void>();
	/** Main-frame navigations and load events seen so far (to tell "the page navigated away under an
	 *  eval" from a real hang). */
	navigations = 0;
	loads = 0;
	/** Every retry is logged here and printed: a retry never passes silently. */
	readonly retries: string[] = [];
	constructor(private ws: WebSocket) {
		ws.addEventListener("message", (e) => {
			const m = JSON.parse(String(e.data));
			if (m.method === "Page.frameNavigated" && !m.params?.frame?.parentId) this.navigations++;
			if (m.method === "Page.loadEventFired") this.loads++;
			if (m.id && this.pending.has(m.id)) {
				this.pending.get(m.id)!(m);
				this.pending.delete(m.id);
			}
		});
	}
	private retried(why: string) {
		this.retries.push(why);
		console.log(`  ↻ retry: ${why}`);
	}
	send(method: string, params: Record<string, unknown> = {}): Promise<any> {
		const id = ++this.id;
		this.ws.send(JSON.stringify({ id, method, params }));
		return new Promise((res, rej) => {
			// Never hang: a browser call that does not answer in 20 s fails the check instead.
			const timer = setTimeout(() => {
				this.pending.delete(id);
				rej(new Error(`${method}: no answer in 20 s`));
			}, 20_000);
			this.pending.set(id, (m) => {
				clearTimeout(timer);
				m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result);
			});
		});
	}
	async eval<T>(expr: string, retry = true): Promise<T> {
		const nav = this.navigations;
		const ld = this.loads;
		const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }).catch(async (e) => {
			const short = expr.replace(/\s+/g, " ").slice(0, 120);
			// An awaiting eval never answers when its page navigates away (a live reload when a file changes).
			// Retry once, logged, ONLY then; any other silence is a real failure.
			if (retry && (/Inspected target navigated|context was destroyed/.test(e.message) || (this.navigations !== nav && /no answer/.test(e.message)))) {
				this.retried(`page navigated during an eval (${short.slice(0, 60)}…)`);
				await this.loaded(ld, 10_000); // the new document's load event
				await Bun.sleep(500);
				return { __retry: true };
			}
			throw new Error(`${e.message} · in: ${short}`);
		});
		if (r.__retry) return this.eval<T>(expr, false);
		if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
		return r.result.value as T;
	}
	/** Waits for the next load event (no eval while a document is being swapped in). */
	private async loaded(since: number, ms: number): Promise<boolean> {
		for (let t = 0; t < ms; t += 50) {
			if (this.loads > since) return true;
			await Bun.sleep(50);
		}
		return false;
	}
	async go(url: string) {
		for (let attempt = 1; ; attempt++) {
			const since = this.loads;
			await this.send("Page.navigate", { url });
			if (await this.loaded(since, 20_000)) break;
			// A first load that never fires its load event: retry the navigation once, logged.
			if (attempt === 2) throw new Error(`${url}: page did not finish loading in 20 s (twice)`);
			this.retried(`${url} did not finish loading in 20 s; navigating again`);
		}
		// kit.js fetches the glossary, annotates, waits for the web font, then fits the page.
		await this.eval("document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400)))");
		await Bun.sleep(300);
	}
	async size(v: Viewport) {
		if (!v.window) {
			await this.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr, mobile: !!v.mobile });
			await Bun.sleep(250);
			return;
		}
		// A real window: resize it until the page's inner size is the target (±1 px of rounding at 1.25).
		await this.send("Emulation.clearDeviceMetricsOverride");
		const { windowId } = await this.send("Browser.getWindowForTarget");
		for (let i = 0; i < 4; i++) {
			await Bun.sleep(250);
			const [iw, ih] = await this.eval<number[]>("[innerWidth, innerHeight]");
			if (Math.abs(iw - v.w) <= 1 && Math.abs(ih - v.h) <= 1) return;
			const { bounds } = await this.send("Browser.getWindowBounds", { windowId });
			await this.send("Browser.setWindowBounds", { windowId, bounds: { width: bounds.width + v.w - iw, height: bounds.height + v.h - ih } });
		}
		const [iw, ih, dpr] = await this.eval<number[]>("[innerWidth, innerHeight, devicePixelRatio]");
		if (Math.abs(iw - v.w) > 1 || Math.abs(ih - v.h) > 1 || dpr !== v.dpr) throw new Error(`could not size a real window to ${v.label}: got ${iw}×${ih} @${dpr}`);
	}
	async shot(file: string) {
		const r = await this.send("Page.captureScreenshot", { format: "png" });
		await Bun.write(file, Buffer.from(r.data, "base64"));
	}
}

async function launch(): Promise<{ cdp: Cdp; stop: () => void }> {
	const profile = join(tmpdir(), `info-visual-${Date.now()}`);
	const proc = Bun.spawn(
		[BROWSER, "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, "--window-size=1529,837", `--force-device-scale-factor=${PRIMARY.dpr}`, "--no-first-run",
			// Never treat the page as hidden or background: that throttles timers and makes kit/home skip work.
			"--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "about:blank"],
		{ stdout: "ignore", stderr: "ignore" },
	);
	let target: any = null;
	for (let i = 0; i < 80 && !target; i++) {
		await Bun.sleep(150);
		try {
			const list = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json()) as any[];
			target = list.find((t) => t.type === "page");
		} catch {}
	}
	if (!target) throw new Error("browser did not start");
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((r) => ws.addEventListener("open", r, { once: true }));
	const cdp = new Cdp(ws);
	await cdp.send("Page.enable");
	await cdp.send("DOM.enable");
	await cdp.send("CSS.enable");
	await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
	await cdp.size(PRIMARY);
	await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }] });
	// (reduced motion: no fade-in, so a modal's screenshot shows it fully drawn)
	return {
		cdp,
		stop: () => {
			ws.close();
			proc.kill();
			// Edge/Chrome hand off to child processes; end every process using this run's profile.
			if (process.platform === "win32") {
				const tag = profile.split(/[\\/]/).pop();
				Bun.spawnSync([
					"powershell.exe",
					"-NoProfile",
					"-Command",
					`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
				]);
			}
			// Delete the throwaway profile now (the script exits right after); retry while files unlock.
			for (let i = 0; i < 20; i++) {
				try {
					rmSync(profile, { recursive: true, force: true });
					break;
				} catch {
					Bun.sleepSync(250);
				}
			}
		},
	};
}

// ── checks ──────────────────────────────────────────────────────────────────
interface Check {
	name: string;
	ok: boolean;
	detail: string;
}
interface Result {
	id: string;
	title: string;
	kind: string;
	checks: Check[];
	ok: boolean;
}
const c = (name: string, ok: boolean, detail: string): Check => ({ name, ok, detail });

const VISIBLE = `(el) => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
	return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; }`;

/**
 * The layout audit, run inside the page on `root` (a selector). Returns lists of defects:
 *   clipped   an element with overflow hidden/clip whose content is bigger than its box (content cut off)
 *   ellipsis  text cut by text-overflow: ellipsis or a line clamp (meaning hidden behind "…")
 *   svg       an SVG label outside its viewBox, or outside the box (rect) it labels
 *   overlap   two cards/tiles/blocks, or two SVG labels, drawn on top of each other
 *   scrolls   a box inside the page that scrolls (bird's-eye content must fit, not scroll)
 *   page      how far the page scrolls down / sideways
 *   used      share of the screen below the top bar covered by the bird's-eye content (birdseye only)
 */
const AUDIT = `(async (rootSel, birdseye) => { const MIN_PX = ${MIN_TEXT_PX};
	const vis = ${VISIBLE};
	const root = document.querySelector(rootSel) || document.body;
	const name = (e) => {
		const t = (e.innerText || e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
		const cls = typeof e.className === 'string' ? e.className.split(' ')[0] : '';
		return (e.tagName.toLowerCase() + (cls ? '.' + cls : '')) + (t ? ' “' + t + '”' : '');
	};
	const els = [root, ...root.querySelectorAll('*')].filter((e) => !e.closest('svg') && vis(e) && !e.matches('img, video, canvas, iframe, input, .kit-tip, .kit-tip *'));
	const clipped = [], ellipsis = [], scrolls = [];
	for (const e of els) {
		const s = getComputedStyle(e);
		const overX = e.scrollWidth > e.clientWidth + 1, overY = e.scrollHeight > e.clientHeight + 1;
		if (!overX && !overY) continue;
		const clampY = s.webkitLineClamp && s.webkitLineClamp !== 'none';
		if ((s.textOverflow === 'ellipsis' && overX) || (clampY && overY)) { ellipsis.push(name(e)); continue; }
		const hides = (o) => o === 'hidden' || o === 'clip';
		if ((overX && hides(s.overflowX)) || (overY && hides(s.overflowY))) { clipped.push(name(e) + (overY ? ' ↓' + (e.scrollHeight - e.clientHeight) + 'px' : ' →' + (e.scrollWidth - e.clientWidth) + 'px')); continue; }
		const scrollsHere = (o) => o === 'auto' || o === 'scroll';
		if (e !== document.documentElement && e !== document.body && !e.matches('.kit-layer, .kit-dialog') && ((overX && scrollsHere(s.overflowX)) || (overY && scrollsHere(s.overflowY))))
			scrolls.push(name(e));
		// A modal dialog may scroll down, never sideways.
		if (e.matches('.kit-dialog') && overX && scrollsHere(s.overflowX)) scrolls.push(name(e) + ' (sideways)');
	}
	// SVG labels: inside the viewBox and inside the rect of their own node, and big enough to read.
	const svg = [], overlap = [], tiny = [];
	for (const sv of root.querySelectorAll('svg')) {
		if (!vis(sv)) continue;
		const vb = sv.viewBox && sv.viewBox.baseVal;
		const texts = [...sv.querySelectorAll('text')].filter((t) => t.textContent.trim());
		const scale = vb && vb.width ? sv.getBoundingClientRect().width / vb.width : 1;
		for (const t of texts) {
			const px = parseFloat(getComputedStyle(t).fontSize) * scale;
			if (px < MIN_PX) tiny.push('“' + t.textContent.trim().slice(0, 30) + '” ' + px.toFixed(1) + 'px');
			const b = t.getBBox();
			if (vb && vb.width && (b.x < vb.x - 0.5 || b.y < vb.y - 0.5 || b.x + b.width > vb.x + vb.width + 0.5 || b.y + b.height > vb.y + vb.height + 0.5))
				svg.push('“' + t.textContent.trim().slice(0, 30) + '” outside the viewBox');
			const rect = t.parentElement && t.parentElement.querySelector(':scope > rect');
			if (rect) {
				const r = rect.getBBox();
				if (b.x < r.x - 0.5 || b.x + b.width > r.x + r.width + 0.5 || b.y < r.y - 0.5 || b.y + b.height > r.y + r.height + 0.5)
					svg.push('“' + t.textContent.trim().slice(0, 30) + '” spills out of its box');
			}
		}
		const rs = texts.map((t) => [t, t.getBoundingClientRect()]);
		for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
			const a = rs[i][1], b = rs[j][1];
			if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)
				overlap.push('labels “' + rs[i][0].textContent.trim().slice(0, 20) + '” × “' + rs[j][0].textContent.trim().slice(0, 20) + '”');
		}
	}
	// Blocks on top of each other (siblings only: nesting is not overlap).
	const blocks = [...root.querySelectorAll('.kit-tile, .kit-card, .card, .kit-answer, .kit-visual, .kit-node')].filter(vis);
	for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
		const p = blocks[i], q = blocks[j];
		if (p.contains(q) || q.contains(p)) continue;
		const a = p.getBoundingClientRect(), b = q.getBoundingClientRect();
		if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)
			overlap.push(name(p) + ' × ' + name(q));
	}
	// Measured on the scrolling element against the visible area (innerHeight minus a horizontal
	// scrollbar, clientWidth = width minus a vertical scrollbar).
	const se = document.scrollingElement || document.documentElement;
	const out = { clipped, ellipsis, svg, overlap, scrolls, tiny,
		down: Math.max(0, se.scrollHeight - se.clientHeight), wide: Math.max(0, se.scrollWidth - se.clientWidth),
		scrollbar: innerWidth - document.documentElement.clientWidth };
	if (birdseye) {
		// Union of the bird's-eye blocks, clipped to the screen below the top bar.
		const bar = document.querySelector('.kit-bar');
		const top = bar ? bar.getBoundingClientRect().bottom : 0;
		const kids = [...root.children].filter(vis).map((e) => e.getBoundingClientRect());
		if (kids.length) {
			const l = Math.max(0, Math.min(...kids.map((r) => r.left))), r = Math.min(innerWidth, Math.max(...kids.map((r) => r.right)));
			const t = Math.max(top, Math.min(...kids.map((r) => r.top))), b = Math.min(innerHeight, Math.max(...kids.map((r) => r.bottom)));
			out.used = Math.max(0, r - l) * Math.max(0, b - t) / (innerWidth * (innerHeight - top));
			out.gutters = Math.round(innerWidth - (r - l));
			out.below = Math.round(innerHeight - b);
		} else out.used = 0;
	}
	return out;
})`;
interface Audit {
	clipped: string[];
	ellipsis: string[];
	svg: string[];
	tiny: string[];
	scrollbar: number;
	overlap: string[];
	scrolls: string[];
	down: number;
	wide: number;
	used?: number;
	gutters?: number;
	below?: number;
}
const audit = (cdp: Cdp, root: string, birdseye: boolean) => cdp.eval<Audit>(`${AUDIT}(${JSON.stringify(root)}, ${birdseye})`);
const few = (xs: string[]) => xs.slice(0, 3).join(" | ") + (xs.length > 3 ? ` (+${xs.length - 3} more)` : "");

/** Paged grids: no near-empty last page. Every page holds within one row of the fullest page. */
const balanced = (what: string, counts: number[], cols: number, where: string): Check => {
	const even = counts.length < 2 || Math.max(...counts) - Math.min(...counts) <= cols;
	// A page whose last row holds a single card (11 cards at 5 per row = 5 + 5 + 1).
	const lone = counts.filter((n) => cols > 1 && n > 1 && n % cols === 1);
	return c(
		`${what}: pages evenly filled, no card alone on a row · ${where}`,
		even && lone.length === 0,
		`cards per page: ${counts.join(" / ")} (${cols} per row)${lone.length ? " · a lone card on the last row" : ""}`,
	);
};

/** What a walk through home's library saw: each page's cards, its column count and any layout defect. */
interface Library {
	seen: string[];
	pages: number;
	defects: string[];
	infos: string[];
	counts: number[];
	cols: number;
}
/** Opens home's library once the button shows `count` (a regex) artifacts, and walks every page. */
const walkLibrary = (cdp: Cdp, count: string) =>
	cdp.eval<Library>(`(async () => { for (let i = 0; i < 50 && !/All ${count}/.test(document.getElementById('open-lib').textContent); i++) await new Promise(r => setTimeout(r, 100));
		document.getElementById('open-lib').click(); await new Promise(r => setTimeout(r, 300));
		// The library reopens on the page it was left at: walk from the first page.
		for (let i = 0; i < 50; i++) { const prev = document.querySelector('.lib [data-prev]'); if (!prev || prev.disabled) break; prev.click(); await new Promise(r => setTimeout(r, 50)); }
		const seen = new Set(); let pages = 0; const defects = []; const infos = []; const counts = [];
		for (let i = 0; i < 50; i++) {
			pages++; infos.push(document.querySelector('.lib .info')?.textContent || ''); document.querySelectorAll('.lib a.card').forEach(a => seen.add(a.getAttribute('href').replace('/view/', '')));
			const a = await ${AUDIT}('.lib', false);
			for (const k of ['clipped', 'ellipsis', 'svg', 'tiny', 'overlap', 'scrolls']) for (const x of a[k]) defects.push(k + ': ' + x);
			counts.push(document.querySelectorAll('.lib a.card').length);
			const next = document.querySelector('.lib [data-next]'); if (!next || next.disabled) break;
			next.click(); await new Promise(r => setTimeout(r, 150));
		}
		const fit = ${MODAL_FITS};
		if (!fit.fits) defects.push('dialog off screen: ' + fit.detail);
		const cols = getComputedStyle(document.querySelector('.lib .cards')).gridTemplateColumns.split(' ').length;
		return { seen: [...seen], pages, defects, infos, counts, cols }; })()`);

/** What can be hovered or focused: its hover/focus ring must never be cut by a scrolling or clipping box. */
const HOVERABLE = "a[href], button, input, [data-kit-open], [data-term], [data-ref], [tabindex], .card, .kit-card, .kit-tile";
/** For every element marked data-hc (state forced on): border box + outline + ring (box-shadow spread),
 *  as drawn after transforms, against each ancestor that clips (overflow other than visible). An element
 *  that is itself scrolled out of view is not counted: only a ring cut off a fully visible element. */
const HOVER_CLIP = String.raw`(() => {
	const out = [];
	const name = (e) => (e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '')) + ' “' + (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '”';
	for (const e of document.querySelectorAll('[data-hc]')) {
		const s = getComputedStyle(e);
		const r = e.getBoundingClientRect();
		const scale = e.offsetWidth ? r.width / e.offsetWidth : 1;
		let ext = 0;
		if (s.outlineStyle !== 'none') ext = Math.max(ext, (parseFloat(s.outlineWidth) || 0) + (parseFloat(s.outlineOffset) || 0));
		if (s.boxShadow && s.boxShadow !== 'none')
			for (const sh of s.boxShadow.split(/,(?![^(]*\))/)) {
				if (sh.includes('inset')) continue;
				const n = sh.replace(/rgba?\([^)]*\)|#[0-9a-f]+/gi, '').trim().split(/\s+/).map(parseFloat).filter((x) => !isNaN(x));
				if (n.length >= 4 && n[3] > 0) ext = Math.max(ext, n[3]);
			}
		ext *= scale;
		if (ext <= 0) continue;
		const ring = { l: r.left - ext, t: r.top - ext, r: r.right + ext, b: r.bottom + ext };
		for (let p = e.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
			const ps = getComputedStyle(p);
			if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
			const pr = p.getBoundingClientRect();
			const k = p.offsetWidth ? pr.width / p.offsetWidth : 1;
			const clip = { l: pr.left + p.clientLeft * k, t: pr.top + p.clientTop * k, r: pr.left + (p.clientLeft + p.clientWidth) * k, b: pr.top + (p.clientTop + p.clientHeight) * k };
			const inside = r.left >= clip.l - 0.5 && r.top >= clip.t - 0.5 && r.right <= clip.r + 0.5 && r.bottom <= clip.b + 0.5;
			if (!inside) break; // scrolled out of view: not a ring problem
			const cut = [['top', clip.t - ring.t], ['left', clip.l - ring.l], ['right', ring.r - clip.r], ['bottom', ring.b - clip.b]].filter(([, d]) => d > 0.5);
			if (cut.length) { out.push(name(e) + ' ring cut by ' + name(p).split(' ')[0] + ' (' + cut.map(([w, d]) => w + ' ' + d.toFixed(1) + 'px').join(', ') + ')'); break; }
		}
	}
	return out;
})()`;

async function forceState(cdp: Cdp, selector: string, states: string[], ids?: number[]): Promise<number[]> {
	if (!ids) {
		const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
		ids = (await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector })).nodeIds as number[];
	}
	for (const nodeId of ids) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: states });
	return ids;
}
/** Forces :hover + :focus-visible on every hoverable element under `root` and returns the cut rings. */
async function hoverClips(cdp: Cdp, root: string): Promise<string[]> {
	const n = await cdp.eval<number>(`(() => { const vis = ${VISIBLE}; let i = 0;
		document.querySelectorAll('[data-hc]').forEach((e) => e.removeAttribute('data-hc'));
		for (const r of document.querySelectorAll(${JSON.stringify(root)}))
			for (const e of [r, ...r.querySelectorAll(${JSON.stringify(HOVERABLE)})])
				if (e.matches(${JSON.stringify(HOVERABLE)}) && !e.closest('svg') && vis(e)) e.setAttribute('data-hc', String(i++));
		return i; })()`);
	if (!n) return [];
	const ids = await forceState(cdp, "[data-hc]", ["hover", "focus", "focus-visible"]);
	await Bun.sleep(80);
	const cut = await cdp.eval<string[]>(HOVER_CLIP);
	await forceState(cdp, "[data-hc]", [], ids);
	return cut;
}
/** A screenshot of the first `selector` in its hover + focus state, to look at by eye. */
async function hoverShot(cdp: Cdp, selector: string, file: string) {
	const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
	const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
	if (!nodeId) return;
	await forceState(cdp, selector, ["hover", "focus-visible"], [nodeId]);
	await Bun.sleep(80);
	await cdp.shot(file);
	await forceState(cdp, selector, [], [nodeId]);
}

/** A real mouse click (CDP input, not element.click()) at the centre of `selector`'s box as measured
 *  `aimMs` before the click, like a person. `before` runs in between. Returns whether `expect` exists. */
async function realClick(cdp: Cdp, selector: string, expect: string, before = "", aimMs = 250): Promise<{ ok: boolean; detail: string }> {
	// Aim as soon as the element can be seen (a hidden or not-yet-drawn button is not a target).
	const box = await cdp.eval<any>(`(async () => { const vis = ${VISIBLE};
		for (let i = 0; i < 100; i++) {
			const e = document.querySelector(${JSON.stringify(selector)});
			if (e && vis(e) && getComputedStyle(e).visibility === 'visible' && Number(getComputedStyle(document.body).opacity) > 0) {
				const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
			await new Promise((r) => setTimeout(r, 20));
		}
		return null; })()`);
	if (!box) return { ok: false, detail: `${selector} not found` };
	if (before) await cdp.eval(before);
	await Bun.sleep(aimMs);
	for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
		await cdp.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1 });
	await Bun.sleep(400);
	const ok = await cdp.eval<boolean>(`!!document.querySelector(${JSON.stringify(expect)})`);
	return { ok, detail: ok ? "opened on the first click" : "the first click did nothing" };
}

/** Turns one audit into checks. `noScroll`: a desktop bird's-eye page must not scroll down. */
function layoutChecks(a: Audit, where: string, o: { noScroll: boolean; space: boolean }): Check[] {
	const out: Check[] = [];
	if (o.noScroll)
		out.push(c(`No page scroll · ${where}`, a.down <= 1 && a.scrollbar === 0, a.down > 1 || a.scrollbar ? `${a.down}px below the fold, ${a.scrollbar}px scrollbar` : "fits one screen, no scrollbar"));
	out.push(c(`No sideways scroll · ${where}`, a.wide <= 1, a.wide > 1 ? `${a.wide}px wider than the window` : "fits the width"));
	out.push(c(`Nothing clipped · ${where}`, a.clipped.length === 0, a.clipped.length ? few(a.clipped) : "no hidden overflow"));
	out.push(c(`No text cut by “…” · ${where}`, a.ellipsis.length === 0, a.ellipsis.length ? few(a.ellipsis) : "all text shown in full"));
	out.push(c(`SVG labels inside their drawing · ${where}`, a.svg.length === 0, a.svg.length ? few(a.svg) : "all labels inside"));
	out.push(c(`Diagram text readable (≥ ${MIN_TEXT_PX}px) · ${where}`, a.tiny.length === 0, a.tiny.length ? few(a.tiny) : "all labels readable"));
	out.push(c(`Nothing overlaps · ${where}`, a.overlap.length === 0, a.overlap.length ? few(a.overlap) : "no overlap"));
	out.push(c(`No inner scrolling box · ${where}`, a.scrolls.length === 0, a.scrolls.length ? few(a.scrolls) : "none"));
	if (o.space && a.used !== undefined)
		out.push(
			c(
				`Screen used, no big empty space · ${where}`,
				a.used >= MIN_USED,
				`${Math.round(a.used * 100)}% of the screen used (min ${MIN_USED * 100}%) · ${a.gutters}px side gutters · ${a.below}px empty below`,
			),
		);
	return out;
}

/** The checks of one bird's-eye page (kit page or home) at every desktop size and on a phone. */
async function layoutAllSizes(cdp: Cdp, url: string, root: string): Promise<Check[]> {
	const out: Check[] = [];
	for (const v of [...DESKTOP, PHONE]) {
		await cdp.size(v);
		await cdp.go(url);
		const desktop = !v.mobile;
		out.push(...layoutChecks(await audit(cdp, root, desktop), v.label, { noScroll: desktop, space: desktop }));
		const rings = await hoverClips(cdp, root);
		out.push(c(`Hover/focus rings never cut · ${v.label}`, rings.length === 0, rings.length ? few(rings) : "every hoverable element's ring fully drawn"));
		// A paged grid: walk its pages; each must be clean and evenly filled.
		const pg = await cdp.eval<any>(`(async () => { const box = document.querySelector('.kit-pages'); if (!box || ${!desktop}) return null;
			const counts = [], defects = [];
			for (let i = 0; i < 30; i++) {
				counts.push(box.querySelectorAll('.kit-grid > *').length);
				const a = await ${AUDIT}(${JSON.stringify(root)}, false);
				for (const k of ['clipped', 'ellipsis', 'svg', 'tiny', 'overlap', 'scrolls']) for (const x of a[k]) defects.push(k + ': ' + x);
				if (a.down > 1) defects.push('page scrolls ' + a.down + 'px');
				const next = box.querySelector('[data-kit-next]'); if (!next || next.disabled || box.querySelector('.kit-pager').hidden) break;
				next.click(); await new Promise(r => setTimeout(r, 150));
			}
			return { counts, defects, cols: getComputedStyle(box.querySelector('.kit-grid')).gridTemplateColumns.split(' ').length }; })()`);
		if (pg) {
			out.push(balanced("Paged grid", pg.counts, pg.cols, v.label));
			out.push(c(`Paged grid: every page clean · ${v.label}`, pg.defects.length === 0, pg.defects.length ? few(pg.defects) : `${pg.counts.length} page(s) clean`));
		}
	}
	await cdp.size(PRIMARY);
	return out;
}

/** Closes open modals/library with Back, ONLY while one is open: a Back with nothing open would
 * leave the page, and an eval awaiting on a page that navigates away never answers. */
const closeLayers = (cdp: Cdp) =>
	cdp.eval(`(async () => {
		for (let i = 0; i < 10; i++) {
			const n = document.querySelectorAll('.kit-layer').length;
			if (!n) return;
			history.back();
			// One Back per layer: wait until it has really closed before the next Back.
			for (let t = 0; t < 40 && document.querySelectorAll('.kit-layer').length >= n; t++) await new Promise(r => setTimeout(r, 50));
		}
	})()`);

/** Opens modal `open` (JS expression), audits the top layer, closes it. */
const MODAL_FITS = `(() => { const layers = document.querySelectorAll('.kit-layer'); const top = layers[layers.length - 1];
	const d = top?.querySelector('.kit-dialog'); if (!d) return { fits: false, detail: 'no dialog' };
	const r = d.getBoundingClientRect();
	return { fits: r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
		detail: Math.round(r.width) + '×' + Math.round(r.height) + ' at ' + Math.round(r.left) + ',' + Math.round(r.top) }; })()`;

async function checkKit(cdp: Cdp, id: string): Promise<Check[]> {
	const url = `${BASE}/a/${id}/`;
	const checks = await layoutAllSizes(cdp, url, ".kit-birdseye");
	// A details modal survives a live-reload tick: the file changes, a person clicks, the page must not
	// reload under the open modal (nor swallow the click).
	await cdp.go(url);
	const file = join(CONTENT, "artifacts", `${id}.html`);
	const now = new Date();
	utimesSync(file, now, now);
	const live = await realClick(cdp, "[data-kit-open]", ".kit-layer", "", 50);
	await Bun.sleep(6000); // > one live-reload poll (5 s)
	const kept = live.ok && (await cdp.eval<boolean>("!!document.querySelector('.kit-layer')"));
	checks.push(c("A click opens details even as the file changes; the open modal survives the live reload", kept, !live.ok ? live.detail : kept ? "modal still open after the reload tick" : "the page reloaded under the open modal"));
	await closeLayers(cdp);
	await cdp.go(url);
	await cdp.shot(join(SHOTS, `${id}.png`));
	await hoverShot(cdp, ".kit-birdseye .kit-card, .kit-birdseye button.kit-tile", join(SHOTS, `${id}--hover.png`));
	const page = await cdp.eval<any>(`(() => { const vis = ${VISIBLE};
		const ans = document.querySelector('.kit-answer');
		const r = ans?.getBoundingClientRect();
		return {
			answer: vis(ans) && r.top < innerHeight && (ans.innerText || '').trim().length > 20,
			answerText: (ans?.innerText || '').split('\\n')[0].slice(0, 90),
			visual: [...document.querySelectorAll('.kit-birdseye .kit-visual, .kit-birdseye .kit-pages')].filter(vis).length,
			drawn: [...document.querySelectorAll('.kit-birdseye svg, .kit-birdseye .kit-bars, .kit-birdseye .kit-pages img')].filter(vis).length,
			terms: document.querySelectorAll('.kit-birdseye .kit-term').length,
			opens: [...new Set([...document.querySelectorAll('[data-kit-open]')].map(e => e.dataset.kitOpen))],
			modals: [...document.querySelectorAll('.kit-modal-src')].map(e => e.id.slice(2)),
		}; })()`);
	checks.unshift(
		c("Answer visible on first screen", page.answer, page.answerText || "no answer block"),
		c("Illustration drawn", page.visual > 0 && page.drawn > 0, `${page.visual} visual block(s), ${page.drawn} drawn chart/diagram/image(s)`),
		c("Terms marked for hover", page.terms > 0, `${page.terms} term(s) on the first screen`),
	);
	// Hover → tooltip (fully on screen) → underlined word → stacked modal.
	const hover = await cdp.eval<any>(`(async () => {
		const t = document.querySelector('.kit-birdseye .kit-term'); if (!t) return { tip: false };
		t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await new Promise(r => setTimeout(r, 250));
		const tip = document.querySelector('.kit-tip'); const ref = tip?.querySelector('[data-ref]');
		const tr = tip?.getBoundingClientRect();
		const out = { tip: !!tip && tip.innerText.length > 10, term: t.textContent, ref: !!ref,
			onScreen: !!tr && tr.left >= 0 && tr.top >= 0 && tr.right <= innerWidth && tr.bottom <= innerHeight };
		if (ref) { ref.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 250));
			out.stacked = document.querySelectorAll('.kit-layer').length; }
		return out; })()`);
	checks.push(c("Hover shows a definition", hover.tip, hover.tip ? `hovering “${hover.term}”` : "no tooltip appeared"));
	if (hover.tip) checks.push(c("Tooltip fully on screen", hover.onScreen, hover.onScreen ? "inside the window" : "cut by the window edge"));
	if (hover.ref) {
		checks.push(c("Underlined word opens a modal on top", hover.stacked >= 1, `${hover.stacked} layer(s) opened`));
		const a = await audit(cdp, ".kit-layer:last-of-type", false);
		const fit = await cdp.eval<any>(MODAL_FITS);
		checks.push(...layoutChecks(a, "term modal", { noScroll: false, space: false }));
		checks.push(c("Term modal fits on screen", fit.fits, fit.detail));
		await closeLayers(cdp);
	}
	// Every modal opens, leads with a drawn visual, fits on screen and has no layout defect.
	const missing = page.opens.filter((o: string) => !page.modals.includes(o));
	checks.push(c("Every “details” button has its modal", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${page.opens.length} buttons`));
	const bad: string[] = [];
	const layoutBad: string[] = [];
	for (const v of [PRIMARY, PHONE]) {
		await cdp.size(v);
		await cdp.go(url);
		for (const m of page.modals as string[]) {
			const r = await cdp.eval<any>(`(async () => { const vis = ${VISIBLE}; window.kit.openModal(${JSON.stringify(m)});
				await new Promise(r => setTimeout(r, 200));
				const layers = document.querySelectorAll('.kit-layer'); const top = layers[layers.length - 1];
				const firstChild = top?.querySelector('.body > div')?.firstElementChild;
				const v = top?.querySelector('.kit-visual');
				return { open: !!top, lead: !!firstChild && firstChild.classList.contains('kit-visual'), drawn: vis(v) && v.getBoundingClientRect().height > 30 }; })()`);
			const a = await audit(cdp, ".kit-layer:last-of-type", false);
			const fit = await cdp.eval<any>(MODAL_FITS);
			if (v === PRIMARY) await cdp.shot(join(SHOTS, `${id}--m-${m}.png`));
			await closeLayers(cdp);
			if (v === PRIMARY && (!r.open || !r.lead || !r.drawn)) bad.push(m);
			const defects = layoutChecks(a, "", { noScroll: false, space: false }).filter((x) => !x.ok);
			if (!fit.fits) defects.push(c("off screen", false, fit.detail));
			if (defects.length) layoutBad.push(`${m} @${v.label}: ${defects.map((d) => `${d.name.replace(" · ", "")}: ${d.detail}`).join("; ")}`);
		}
	}
	await cdp.size(PRIMARY);
	checks.push(c("Every modal opens with a drawn visual", bad.length === 0, bad.length ? `failed: ${bad.join(", ")}` : `${page.modals.length} modals opened`));
	checks.push(
		c(
			"Every modal fits, nothing clipped or overlapping (Arpan's screen + phone)",
			layoutBad.length === 0,
			layoutBad.length ? few(layoutBad) : `${page.modals.length} modals × 2 sizes clean`,
		),
	);
	return checks;
}

async function checkLegacy(cdp: Cdp, id: string): Promise<Check[]> {
	await cdp.go(`${BASE}/view/${id}`);
	await Bun.sleep(400);
	await cdp.shot(join(SHOTS, `${id}.png`));
	const r = await cdp.eval<any>(`(() => { const f = document.querySelector('iframe'); const d = f?.contentDocument;
		const box = f?.getBoundingClientRect();
		return { frame: !!f && box.height > 300 && Math.abs(box.bottom - innerHeight) <= 1 && Math.abs(box.width - innerWidth) <= 1,
			back: !!document.querySelector('.kit-back'),
			text: (d?.body?.innerText || '').trim().length, title: d?.title || '' }; })()`);
	// The frame's own bar: nothing clipped, no page scroll around the frame.
	const a = await audit(cdp, ".kit-bar", false);
	return [
		c("Back bar shown", r.back, r.back ? "← Home" : "missing"),
		c("Page fills the frame", r.frame, r.frame ? "frame fills the screen below the bar" : "frame missing, tiny or not filling the window"),
		c("Real content visible", r.text > 200, `${r.text.toLocaleString("en")} characters of text${r.title ? ` · “${r.title}”` : ""}`),
		...layoutChecks(a, PRIMARY.label, { noScroll: true, space: false }),
	];
}

// ── run ─────────────────────────────────────────────────────────────────────
const health = await fetch(`${BASE}/api/health`).catch(() => null);
if (!health?.ok) {
	console.error(`✗ info server not reachable at ${BASE} — start it: bun tools/info-server/server.ts`);
	process.exit(1);
}
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });
const manifest = (await (await fetch(`${BASE}/api/artifacts`)).json()) as {
	artifacts: Array<{ id: string; title: string; kind: string }>;
};
const ONLY = process.env["ONLY"]; // e.g. ONLY=home,recsys-overview to re-check a few pages
const targets = manifest.artifacts.filter((a) => a.id !== "info-check" && (!ONLY || ONLY.split(",").includes(a.id)));
const { cdp, stop } = await launch();
const results: Result[] = [];
const report = (r: Result) => {
	results.push(r);
	console.log(`${r.ok ? "✓" : "✗"} ${r.id}${r.checks.filter((x) => !x.ok).map((x) => `\n    — ${x.name}: ${x.detail}`).join("")}`);
};
const { buildCheckPage } = await import("./check-page");
try {
	if (!ONLY || ONLY.split(",").includes("home")) try {
		// Home: one screen at every size (and Arpan's first), nothing cut, every deliverable reachable in the library.
		const homeChecks = await layoutAllSizes(cdp, `${BASE}/`, ".home");
		await cdp.go(`${BASE}/`);
		await cdp.shot(join(SHOTS, "home.png"));
		const r = await cdp.eval<any>(`(() => ({ focus: (document.getElementById('focus')?.innerText || '').trim(),
			latest: document.querySelectorAll('#latest a.card').length }))()`);
		homeChecks.unshift(c("Home shows the current focus and latest cards", r.focus.length > 0 && r.latest > 0, `“${r.focus}” · ${r.latest} latest cards`));
		await hoverShot(cdp, "#latest a.card", join(SHOTS, "home--hover.png"));
		// The first click works: as soon as the button shows on a cold, slow load (no cache, 400 ms per
		// request: the web font and /api arrive late, as on a first visit), and right after a refresh tick.
		await cdp.send("Network.enable");
		await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
		await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: -1, uploadThroughput: -1 });
		await cdp.send("Page.navigate", { url: `${BASE}/` });
		for (let i = 0; i < 100; i++) {
			await Bun.sleep(50);
			if ((await cdp.eval<string>("document.readyState").catch(() => "")) !== "loading") break;
		}
		// A person aims at the button when it first shows and clicks a moment later: it must not move
		// in between (data and web font arriving late re-lay the page). Clicked once everything settled.
		const first = await realClick(cdp, "#open-lib", ".lib", "", 2500);
		await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
		await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
		homeChecks.push(c("Library opens on the first click where its button first showed (cold, slow load)", first.ok, first.ok ? first.detail : `${first.detail}: the button moved after it appeared`));
		await closeLayers(cdp);
		await cdp.go(`${BASE}/`);
		const tick = await realClick(cdp, "#open-lib", ".lib", "document.dispatchEvent(new Event('visibilitychange'))", 120);
		homeChecks.push(c("Library opens on a click right after a refresh tick", tick.ok, tick.detail));
		const stays = tick.ok && (await cdp.eval<boolean>(`(async () => { document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 800)); return !!document.querySelector('.lib'); })()`));
		homeChecks.push(c("A refresh tick never closes the open library", stays, stays ? "still open after a tick" : "closed by the tick"));
		await closeLayers(cdp);
		for (const v of DESKTOP) {
			await cdp.size(v);
			await cdp.go(`${BASE}/`);
			// Wait for the home data (the button shows the count once /api/artifacts has loaded).
			const lib = await walkLibrary(cdp, "[1-9]");
			if (v === PRIMARY) await cdp.shot(join(SHOTS, "home--library.png"));
			// Rings on the library's last page (its cards sit in a clipping grid).
			const libRings = await hoverClips(cdp, ".lib");
			homeChecks.push(c(`Library: hover/focus rings never cut · ${v.label}`, libRings.length === 0, libRings.length ? few(libRings) : "all rings fully drawn"));
			if (v === PRIMARY) await hoverShot(cdp, ".lib a.card", join(SHOTS, "home--library--hover.png"));
			await closeLayers(cdp);
			const absent = manifest.artifacts.filter((a) => !lib.seen.includes(a.id)).map((a) => a.id);
			homeChecks.push(c(`Library: every deliverable has a card · ${v.label}`, absent.length === 0, absent.length ? `no card: ${few(absent)} · pager said: ${lib.infos.join(" / ")}` : `${lib.seen.length} cards over ${lib.pages} page(s)`));
			homeChecks.push(balanced("Library", lib.counts, lib.cols, v.label));
			homeChecks.push(c(`Library: no clipping, overlap or scrolling · ${v.label}`, lib.defects.length === 0, lib.defects.length ? few(lib.defects) : "clean on every page"));
		}
		await cdp.size(PRIMARY);
		report({ id: "home", title: "Home page", kind: "home", checks: homeChecks, ok: homeChecks.every((x) => x.ok) });
	} catch (e) {
		report({ id: "home", title: "Home page", kind: "home", checks: [c("Page could be checked", false, String(e))], ok: false });
	}
	for (const a of targets) {
		let checks: Check[];
		try {
			checks = a.kind === "kit" ? await checkKit(cdp, a.id) : await checkLegacy(cdp, a.id);
		} catch (e) {
			checks = [c("Page could be checked", false, String(e))];
		}
		report({ id: a.id, title: a.title, kind: a.kind, checks, ok: checks.every((x) => x.ok) });
	}
	// Kit fit self-test: sweep a bird's-eye's height through near-fit sizes (fractions of a pixel from
	// the window edge) on Arpan's screen. A page that fits must never keep a scrollbar.
	const fitSelf: Check[] = [];
	try {
		await cdp.size(PRIMARY);
		await cdp.send("Page.bringToFront");
		await cdp.go(`${BASE}/kit/fit-fixture.html`);
		const sweep = { n: 0, bad: [] as string[] };
		for (let from = 260; from <= 760; from += 25) {
			// In chunks: each eval stays well under the 20 s answer limit.
			const part = await cdp.eval<{ n: number; bad: string[] }>(`(async () => {
				const block = document.getElementById('block'); const se = document.scrollingElement;
				// No requestAnimationFrame: it pauses whenever the target is not the visible one, and the eval
				// then never answers. Reading layout (clientWidth, scrollHeight) forces layout, scrollbar included.
				const frame = () => new Promise((r) => setTimeout(r, 0));
				const bad = []; let n = 0;
				for (let h = ${from}; h < ${from + 25}; h += 2.37) {
					block.style.height = h.toFixed(2) + 'px'; window.kit.fitPage(); await frame(); n++;
					const bar = innerWidth - document.documentElement.clientWidth, over = se.scrollHeight - se.clientHeight;
					if (bar > 0 || over > 0) bad.push(h.toFixed(1) + 'px → ' + over + 'px scroll, ' + bar + 'px scrollbar');
				}
				return { n, bad }; })()`);
			sweep.n += part.n;
			sweep.bad.push(...part.bad);
		}
		fitSelf.push(c(`Kit fit: a near-fit page never keeps a scrollbar · ${PRIMARY.label}`, sweep.bad.length === 0, sweep.bad.length ? `${sweep.bad.length} of ${sweep.n} heights: ${few(sweep.bad)}` : `${sweep.n} heights, no scrollbar`));
	} catch (e) {
		fitSelf.push(c("Kit fit self-test could run", false, String(e)));
	}

	// Paging self-test: every paged grid (home's library, kit pages) uses one rule, kit.pagePlan.
	// (1) The plan itself over 1–60 cards and grids of 4–8 columns × 1–5 rows; (2) home's real library
	// with 22–30 artifacts (the real cards, repeated) at every desktop size.
	try {
		const plans = await cdp.eval<Array<{ cards: number; cols: number; rows: number; sizes: number[]; pcols: number }>>(`(() => {
			const out = [];
			for (let cards = 1; cards <= 60; cards++) for (let cols = 4; cols <= 8; cols++) for (let rows = 1; rows <= 5; rows++) {
				const p = window.kit.pagePlan(cards, cols, rows); out.push({ cards, cols, rows, sizes: p.sizes, pcols: p.cols });
			}
			return out; })()`);
		const bad = plans.flatMap((p) => {
			const why = [
				p.sizes.reduce((a, b) => a + b, 0) !== p.cards ? "cards lost" : "",
				p.sizes.some((s) => s > p.pcols * p.rows) ? "a page too tall" : "",
				p.sizes.length > Math.ceil(p.cards / (p.cols * p.rows)) + 1 ? "too many pages" : "",
				balanced("", p.sizes, p.pcols, "").ok ? "" : "uneven or a lone card",
			].filter(Boolean);
			return why.length ? [`${p.cards} at ${p.cols}×${p.rows} → ${p.sizes.join("+")} (${p.pcols} per row): ${why.join(", ")}`] : [];
		});
		fitSelf.push(c("Paging plan: even pages, no lone card, fewest pages (1–60 cards, 4–8 × 1–5 grids)", bad.length === 0, bad.length ? `${bad.length} of ${plans.length}: ${few(bad)}` : `${plans.length} plans, all even`));
	} catch (e) {
		fitSelf.push(c("Paging plan self-test could run", false, String(e)));
	}
	if (!ONLY || ONLY.split(",").includes("home")) for (const v of DESKTOP) {
		try {
