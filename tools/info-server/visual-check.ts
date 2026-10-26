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
