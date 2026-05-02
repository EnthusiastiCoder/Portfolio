// Project info server — shows answers and artifacts illustratively: bird's-eye first, details in
// stacked modals, hover definitions. Local only, read-only. Run: bun tools/info-server/server.ts
// Stop it (whole process tree, frees the port): bun tools/info-server/stop.ts
// The port comes from the machine-wide registry (port.ts): register the workspace once first.
//
// CODE is shared (this folder). CONTENT is each person's own and gitignored: content/ (or
// $INFO_CONTENT_DIR) holds now.json, artifacts.json, glossary.json, artifacts/, builders/.
//
//   /                     home: what we are working on now + pinned and latest; library in a modal
//   /a/<id>/              a kit page (content/artifacts/<id>.html)
//   /view/<id>            any artifact (legacy files framed with a Back bar)
//   /raw/<id>             a legacy file itself
//   /api/now | /api/artifacts | /api/glossary | /api/mtime?id=<id> | /api/health
//   /kit/*                kit.css, kit.js
//
// Rules: GET/HEAD only; Host must be localhost/127.0.0.1; no-store on /api.
//
// Never hangs (designed for Bun's single event loop, not threads): ONE background refresher reads
// every content file with async I/O on a timer and swaps an in-memory snapshot. /api/* answer from
// that snapshot and never touch the disk, so a stalled or locked file can delay the refresher but
// never a request. A refresh that is still running is never started twice (no pile-up), each read
// has a timeout, a half-written or broken file keeps the last good copy, and /api/health reports the
// snapshot's age and the event loop's lag so a stall shows up as numbers, not as a hang.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { buildPlan, HANDOFF_NAME, type Plan, REPORT_NAME, type Writeups } from "./plan";
import { defaultWorkspace, resolvePort } from "./port";

const ROOT = import.meta.dir;
export const CONTENT = resolve(process.env["INFO_CONTENT_DIR"] ?? join(ROOT, "content"));
/** This workspace's port from the machine-wide registry (port.ts); never a hardcoded default. */
let cachedPort: number | undefined;
export const port = () => (cachedPort ??= resolvePort());
/** Where agents write reports and handoffs (the plan's "latest report"): <workspace>/plans/. */
export const PLANS = resolve(process.env["INFO_PLANS_DIR"] ?? join(defaultWorkspace(), "plans"));
/** The running server's pid, for stop.ts (one file per port, outside the content folder). */
export const pidFile = (p: number) => join(tmpdir(), `info-server-${p}.pid`);

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".svg": "image/svg+xml",
};
const SECURITY = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

export interface Artifact {
	id: string;
	title: string;
	kind: "kit" | "legacy";
	/** legacy: absolute, or relative to the content folder. */
	path: string;
	project: string;
	topic: string;
	headline: string;
}
interface Manifest {
	version: number;
	projects: Array<{ id: string; title?: string }>;
	artifacts: Artifact[];
}

/** A content file read synchronously, or `empty` when this person has not made it yet (check.ts, scripts). */
export function content<T>(file: string, empty: T): T {
	const f = join(CONTENT, file);
	return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : empty;
}
export const fileOf = (a: Artifact) =>
	a.kind === "kit" ? join(CONTENT, "artifacts", `${a.id}.html`) : isAbsolute(a.path) ? a.path : resolve(CONTENT, a.path);

// ── the in-memory snapshot and its one refresher ──────────────────────────
const REFRESH_MS = Number(process.env["INFO_REFRESH_MS"] ?? 1000);
const READ_TIMEOUT_MS = 5000;
const EMPTY_MANIFEST: Manifest = { version: 1, projects: [], artifacts: [] };

interface Snapshot {
	now: unknown;
	glossary: unknown;
	manifest: Manifest;
	/** artifact id → file mtime in ms (0 = file missing). */
	mtimes: Map<string, number>;
	plan: Plan;
	writeups: Writeups;
	contentExists: boolean;
	/** When the last refresh finished (ms since epoch), 0 = never. */
	at: number;
	tookMs: number;
	errors: string[];
}
const snap: Snapshot = {
	now: null,
	glossary: { version: 1, terms: {} },
	manifest: EMPTY_MANIFEST,
	mtimes: new Map(),
	plan: { title: null, plan_file: null, updated: null, active: null, steps: [], source: null },
	writeups: { reports: [], handoffs: [] },
	contentExists: false,
	at: 0,
	tookMs: 0,
	errors: [],
};
let refreshing: Promise<void> | null = null;
let refreshStarted = 0;
let refreshes = 0;
const STARTED = new Date().toISOString();

/** File reads started and not yet settled. A read that timed out may still be stuck in the OS (a
 * locked or scanned file); while one is, no new refresh starts, so stuck reads never pile up. */
let pendingIO = 0;
let skipped = 0;
/** A promise that gives up after `ms` (the underlying read may still finish later; it is ignored). */
function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	pendingIO++;
	const settled = p.finally(() => {
		pendingIO--;
		clearTimeout(timer);
	});
	settled.catch(() => {});
	return Promise.race([
		settled,
		new Promise<T>((_, rej) => {
			timer = setTimeout(() => rej(new Error(`${what}: no answer in ${ms} ms`)), ms);
		}),
	]);
}
/** Reads a JSON content file. Missing → `empty`; unreadable or broken → `keep` (the last good copy) + an error. */
async function readJson<T>(file: string, empty: T, keep: T, errors: string[]): Promise<T> {
	const f = join(CONTENT, file);
	try {
		return JSON.parse(await within(readFile(f, "utf8"), READ_TIMEOUT_MS, file)) as T;
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty;
		errors.push(`${file}: ${(e as Error).message}`);
		return keep;
	}
}
async function listDir(dir: string, keep: RegExp, errors: string[]): Promise<string[]> {
	try {
		return (await within(readdir(dir), READ_TIMEOUT_MS, dir)).filter((n) => keep.test(n)).sort().reverse();
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== "ENOENT") errors.push(`${dir}: ${(e as Error).message}`);
		return [];
	}
}
async function mtimeOf(f: string): Promise<number> {
	try {
		return (await within(stat(f), READ_TIMEOUT_MS, f)).mtimeMs;
	} catch {
		return 0;
	}
}

/** One refresh of every content file into memory. Concurrent callers share the refresh in flight. */
export function refresh(): Promise<void> {
	if (refreshing) return refreshing;
	if (pendingIO > 0) {
		skipped++;
		return Promise.resolve();
	}
	refreshStarted = Date.now();
	refreshing = (async () => {
		const errors: string[] = [];
		const [now, glossary, manifest, planRaw, reports, handoffs, contentExists] = await Promise.all([
			readJson("now.json", null, snap.now, errors),
			readJson("glossary.json", { version: 1, terms: {} }, snap.glossary, errors),
			readJson<Manifest>("artifacts.json", EMPTY_MANIFEST, snap.manifest, errors),
			readJson<unknown>("plan.json", null, undefined, errors),
			listDir(join(PLANS, "reports"), REPORT_NAME, errors),
			listDir(join(PLANS, "handoffs"), HANDOFF_NAME, errors),
			mtimeOf(CONTENT).then((t) => t > 0),
		]);
		const list = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
		const times = await Promise.all(list.map((a) => mtimeOf(fileOf(a))));
		snap.now = now;
		snap.glossary = glossary;
		snap.manifest = { ...EMPTY_MANIFEST, ...manifest, artifacts: list };
		snap.mtimes = new Map(list.map((a, i) => [a.id, times[i]!]));
		snap.writeups = { reports, handoffs };
		// A plan.json that could not be read this time keeps the last plan rather than falling back.
		if (planRaw !== undefined) snap.plan = buildPlan(planRaw, now, snap.writeups, list.map((a) => a.id));
		snap.contentExists = contentExists;
		snap.errors = errors;
		snap.tookMs = Date.now() - refreshStarted;
		snap.at = Date.now();
		refreshes++;
	})().finally(() => {
		refreshing = null;
	});
	return refreshing;
}

// Event-loop lag: a timer that should fire every 250 ms; how late it fires is how long the loop was
// blocked. The worst lag of the last ~10 s is reported by /api/health.
const LAG_TICK = 250;
let lagExpected = 0;
const lagWindow: number[] = [];
function startLagMonitor() {
	lagExpected = performance.now() + LAG_TICK;
	setInterval(() => {
		const t = performance.now();
		lagWindow.push(Math.max(0, t - lagExpected));
		if (lagWindow.length > 40) lagWindow.shift();
		lagExpected = t + LAG_TICK;
	}, LAG_TICK);
}

/** The health answer: memory only, never the disk. */
export function health() {
	const t = Date.now();
	return {
		ok: true,
		port: port(),
		pid: process.pid,
		started: STARTED,
		content: snap.contentExists,
		/** Content older than 3 refresh periods, or a refresh that failed: the page shows "stale". */
		stale: !snap.at || t - snap.at > 3 * REFRESH_MS + 2000 || snap.errors.length > 0,
		snapshot: {
			age_ms: snap.at ? t - snap.at : null,
			took_ms: snap.tookMs,
			refreshes,
			refreshing_ms: refreshing ? t - refreshStarted : 0,
			pending_reads: pendingIO,
			skipped_refreshes: skipped,
			artifacts: snap.manifest.artifacts.length,
			errors: snap.errors,
		},
		loop_lag_ms: Math.round(Math.max(0, ...lagWindow)),
	};
}

// ── responses ────────────────────────────────────────────────────────────
async function send(file: string, extra: Record<string, string> = {}): Promise<Response> {
	const f = Bun.file(file);
	if (!(await f.exists())) return new Response("not found", { status: 404 });
	return new Response(f, {
		headers: { "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", ...SECURITY, ...extra },
	});
}
const json = (data: unknown) =>
	new Response(JSON.stringify(data), { headers: { "Content-Type": MIME[".json"]!, "Cache-Control": "no-store", ...SECURITY } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The legacy frame: a Back bar over the original file, in the kit theme. */
function frame(a: Artifact): Response {
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)}</title><link rel="stylesheet" href="/kit/kit.css"></head>
<body class="kit-frame"><header class="kit-bar"><a class="kit-back" href="/">← Home</a><b>${esc(a.title)}</b>
<span class="kit-chip">older format</span><a class="kit-standalone" href="/raw/${esc(a.id)}" target="_blank" rel="noopener">Open standalone</a></header>
<iframe src="/raw/${esc(a.id)}" title="${esc(a.title)}"></iframe></body></html>`;
	return new Response(html, { headers: { "Content-Type": MIME[".html"]!, ...SECURITY } });
}

/** A step's latest report (index.md) or handoff, by its resolved name; only names the refresher listed. */
async function report(name: string): Promise<Response> {
	const kind = name.slice(0, name.indexOf(":"));
	const file = name.slice(name.indexOf(":") + 1);
	const path =
		kind === "report" && snap.writeups.reports.includes(file)
			? join(PLANS, "reports", file, "index.md")
			: kind === "handoff" && snap.writeups.handoffs.includes(file)
				? join(PLANS, "handoffs", file)
				: null;
	if (!path) return new Response("unknown report", { status: 404 });
	try {
		return json({ name, index_md: await within(readFile(path, "utf8"), READ_TIMEOUT_MS, file) });
	} catch (e) {
		return json({ name, index_md: null, error: (e as Error).message });
	}
}

const find = (id: string | null) => snap.manifest.artifacts.find((x) => x.id === id);

export async function handle(req: Request): Promise<Response> {
	if (req.method !== "GET" && req.method !== "HEAD") return new Response("read-only", { status: 405 });
	const host = (req.headers.get("host") ?? "").split(":")[0];
	if (host !== "localhost" && host !== "127.0.0.1") return new Response("local only", { status: 403 });
	const url = new URL(req.url);
	const p = decodeURIComponent(url.pathname);

	// The API answers from memory only.
	if (p === "/api/health") return json(health());
	if (!snap.at) await refresh(); // the very first request may arrive before the first refresh ends
	if (p === "/api/now") return json(snap.now);
	if (p === "/api/glossary") return json(snap.glossary);
	if (p === "/api/artifacts") {
		const m = snap.manifest;
		const modified = (a: Artifact) => {
			const t = snap.mtimes.get(a.id) ?? 0;
			return t ? new Date(t).toISOString() : null;
		};
		return json({ ...m, artifacts: m.artifacts.map((a) => ({ ...a, modified: modified(a) })) });
	}
	if (p === "/api/mtime") return json({ mtime: snap.mtimes.get(url.searchParams.get("id") ?? "") ?? 0 });
	if (p === "/api/plan") return json(snap.plan);
	if (p === "/api/report") return report(url.searchParams.get("name") ?? "");

	// Files are streamed by Bun (async), never read synchronously on the event loop.
	if (p === "/" || p === "/index.html") return send(join(ROOT, "home.html"), { "Cache-Control": "no-store" });
	if (p.startsWith("/kit/")) {
		const f = resolve(ROOT, "kit", p.slice(5));
		return f.startsWith(join(ROOT, "kit")) ? send(f, { "Cache-Control": "no-store" }) : new Response("no", { status: 404 });
	}
	const m = /^\/(a|view|raw)\/([a-z0-9][a-z0-9-]{1,63})\/?(.*)$/.exec(p);
	if (m) {
		const [, mode, id, rest] = m;
		let a = find(id!);
		// Just registered (artifacts.json written a moment ago): one fresh refresh before a 404.
		if (!a) {
			await refresh();
			a = find(id!);
		}
		if (!a) return new Response("unknown artifact", { status: 404 });
		if (mode === "view") return a.kind === "kit" ? Response.redirect(`/a/${id}/`, 302) : frame(a);
		const file = fileOf(a);
		if (!rest) return send(file, { "Cache-Control": "no-store" });
		// Sibling files (images next to the page), never outside its folder.
		const sib = resolve(dirname(file), rest);
		return sib.startsWith(dirname(file)) ? send(sib) : new Response("no", { status: 404 });
	}
	return new Response("not found", { status: 404 });
}

if (import.meta.main) {
	const p = port();
	await refresh();
	setInterval(() => void refresh(), REFRESH_MS); // the one refresher; a tick while one runs joins it
	startLagMonitor();
	// One server per port: a second start fails here instead of sharing the port with the first.
	try {
		Bun.serve({ port: p, hostname: "127.0.0.1", fetch: handle, idleTimeout: 30, reusePort: false });
	} catch (e) {
		console.error(`port ${p} is taken (${(e as Error).message}): is the info server already running? bun tools/info-server/stop.ts`);
		process.exit(3);
	}
	writeFileSync(pidFile(p), String(process.pid));
	process.on("exit", () => rmSync(pidFile(p), { force: true }));
	for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(0));
	console.log(`info server on http://localhost:${p} · pid ${process.pid} · content ${CONTENT}`);
}
