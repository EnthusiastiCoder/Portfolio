// Project info server — shows answers and artifacts illustratively: bird's-eye first, details in
// stacked modals, hover definitions. Local only, read-only. Run: bun tools/info-server/server.ts
// Stop it (whole process tree, frees the port): bun tools/info-server/stop.ts
// The port comes from the machine-wide registry (port.ts): register the workspace once first.
//
// CODE is shared (this folder). CONTENT is each person's own and gitignored: content/ (or
// $INFO_CONTENT_DIR) holds now.json, artifacts.json, glossary.json, artifacts/, builders/.
//
//   / /stages /artifacts  home (one app): Now (plan graph + usage strip) | All stages | Artifacts
//   /a/<id>/              a kit page (content/artifacts/<id>.html)
//   /view/<id>            any artifact (legacy files framed with a Back bar; a missing kit page says
//                         how to rebuild it)
//   /raw/<id>             a legacy file itself
//   /api/now | /api/artifacts | /api/glossary | /api/mtime?id=<id> | /api/health
//   /api/plans (every plan) | /api/plan (the default one) | /api/report?name=
//   /api/usage | /api/activity  envelopes: { data, sources: [{ name, ok, as_of_utc, stale, error }] }
//   /api/answers          per question hash: the latest answer from the page, delivered or not, reopened or not
//                         (/api/plans carries each needs-you item's `answer` / `reopened`: answers.ts joinAnswers)
//   POST /api/answer      the ONLY write route (answers.ts): appends to content/answers.jsonl
//   /kit/*                kit.css, kit.js, icons.js
//
// Rules: GET/HEAD only, except POST /api/answer (Origin must be this server); Host must be
// localhost/127.0.0.1; no-store on /api.
//
// Never hangs (designed for Bun's single event loop, not threads): ONE background refresher reads
// every content file with async I/O on a timer and swaps an in-memory snapshot. /api/* answer from
// that snapshot and never touch the disk, so a stalled or locked file can delay the refresher but
// never a request. A refresh that is still running is never started twice (no pile-up), each read
// has a timeout, a half-written or broken file keeps the last good copy, and /api/health reports the
// snapshot's age and the event loop's lag so a stall shows up as numbers, not as a hang.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { type Activity, ACTIVITY_LIMIT, agentRow, emptyActivity, parseGit, WINDOW_MS, writeupRows } from "./activity";
import { ANSWERS, AnswerLog, type AnswerRow, answerState, DELIVERED, type DeliveredRow, joinAnswers, jsonl, MAX_BODY, REOPENED, type ReopenedRow, validate } from "./answers";
import { buildPlans, defaultPlan, HANDOFF_NAME, type Plan, PLAN_FILE, REPORT_NAME, type Writeups } from "./plan";
import { newestFile, type PinState, pinSpecs, probe } from "./pins";
import { defaultWorkspace, resolvePort } from "./port";
import { redact } from "./safety";
import { emptyUsage, refreshUsage, type Source, type UsageConfig, type UsageState } from "./usage";

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
	".pdf": "application/pdf",
	".mp4": "video/mp4",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
	/** Builder scripts present (content/builders/<id>.ts), for the "rebuild with" hint. */
	builders: Set<string>;
	/** The plans as the content says (before the answers are joined). */
	basePlans: Plan[];
	/** The plans with each needs-you item joined to its answer (answers.ts joinAnswers): what /api serves. */
	plans: Plan[];
	/** The plan shown first (needs-you first, else the most recently updated). */
	defaultPlan: string | null;
	usageConfig: UsageConfig | null;
	answers: AnswerRow[];
	delivered: DeliveredRow[];
	reopened: ReopenedRow[];
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
	builders: new Set(),
	basePlans: [{ id: "current", title: null, short: null, plan_file: null, updated: null, active: null, steps: [], source: null }],
	plans: [{ id: "current", title: null, short: null, plan_file: null, updated: null, active: null, steps: [], source: null }],
	defaultPlan: "current",
	usageConfig: null,
	answers: [],
	delivered: [],
	reopened: [],
	writeups: { reports: [], handoffs: [] },
	contentExists: false,
	at: 0,
	tookMs: 0,
	errors: [],
};
/** The last good raw JSON of each plans/<id>.json (a half-written file keeps it). */
const lastPlanRaw = new Map<string, unknown>();
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
/** A text content file, "" when missing; `keep` when unreadable (+ an error). */
async function readText(file: string, keep: string | null, errors: string[]): Promise<string | null> {
	try {
		return await within(readFile(join(CONTENT, file), "utf8"), READ_TIMEOUT_MS, file);
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
		errors.push(`${file}: ${(e as Error).message}`);
		return keep;
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
		const [now, glossary, manifest, planRaw, reports, handoffs, contentExists, planNames, builders, usageConfig, answersText, deliveredText, reopenedText] = await Promise.all([
			readJson("now.json", null, snap.now, errors),
			readJson("glossary.json", { version: 1, terms: {} }, snap.glossary, errors),
			readJson<Manifest>("artifacts.json", EMPTY_MANIFEST, snap.manifest, errors),
			readJson<unknown>("plan.json", null, undefined, errors),
			listDir(join(PLANS, "reports"), REPORT_NAME, errors),
			listDir(join(PLANS, "handoffs"), HANDOFF_NAME, errors),
			mtimeOf(CONTENT).then((t) => t > 0),
			listDir(join(CONTENT, "plans"), PLAN_FILE, errors),
			listDir(join(CONTENT, "builders"), /^[a-z0-9][a-z0-9-]{1,63}\.ts$/, errors),
			readJson<UsageConfig | null>("usage.json", null, snap.usageConfig, errors),
			readText(ANSWERS, null, errors),
			readText(DELIVERED, null, errors),
			readText(REOPENED, null, errors),
		]);
		// Each plan file; a broken or half-written one keeps its last good copy.
		const planFiles = await Promise.all(
			planNames.map(async (n) => {
				const id = n.slice(0, -5);
				const raw = await readJson<unknown>(join("plans", n), null, lastPlanRaw.get(id) ?? null, errors);
				lastPlanRaw.set(id, raw);
				return { id, raw };
			}),
		);
		const list = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
		const times = await Promise.all(list.map((a) => mtimeOf(fileOf(a))));
		snap.now = now;
		snap.glossary = glossary;
		snap.manifest = { ...EMPTY_MANIFEST, ...manifest, artifacts: list };
		snap.mtimes = new Map(list.map((a, i) => [a.id, times[i]!]));
		snap.writeups = { reports, handoffs };
		snap.builders = new Set(builders.map((n) => n.slice(0, -3)));
		snap.usageConfig = usageConfig;
		if (answersText !== null) snap.answers = jsonl<AnswerRow>(answersText);
		if (deliveredText !== null) snap.delivered = jsonl<DeliveredRow>(deliveredText);
		if (reopenedText !== null) snap.reopened = jsonl<ReopenedRow>(reopenedText);
		// A plan.json that could not be read this time keeps the last plans rather than falling back.
		if (planRaw !== undefined) snap.basePlans = buildPlans(planFiles, planRaw, now, snap.writeups, list.map((a) => a.id));
		// Every refresh: an answer sent a moment ago makes its item answered without any plan edit.
		snap.plans = joinAnswers(snap.basePlans, snap.answers, snap.delivered, snap.reopened);
		snap.defaultPlan = defaultPlan(snap.plans);
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
		/** Every source the pages show, for the Freshness badge: content, usage groups, activity. */
		sources: sources(),
	};
}
/** The content snapshot as a source row, plus the slow sources (usage, activity). */
function sources(): Source[] {
	const t = Date.now();
	const content: Source = {
		name: "content",
		ok: snap.errors.length === 0 && snap.at > 0,
		as_of_utc: snap.at ? new Date(snap.at).toISOString() : null,
		stale: !snap.at || t - snap.at > 3 * REFRESH_MS + 2000 || snap.errors.length > 0,
		error: snap.errors.length ? redact(snap.errors.join(" · ")) : null,
	};
	return [content, ...usage.sources, ...activitySources];
}

// ── the slow refresher: usage (account-wide numbers) and activity, off the content timer ──────
const SLOW_MS = Number(process.env["INFO_SLOW_REFRESH_MS"] ?? 30_000);
let usage: UsageState = emptyUsage();
let activity: Activity = emptyActivity();
let activitySources: Source[] = [];
let slowAt = 0;
let slowRunning: Promise<void> | null = null;
/** Runs a command with a timeout (killed after it). Bun.spawn is async: the event loop never waits. */
async function run(cmd: string[], ms: number): Promise<string> {
	const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe", stdin: "ignore", windowsHide: true });
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			(async () => {
				const [text, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
				if (code !== 0) throw new Error(`${basename(cmd[0] ?? "")} exited ${code}: ${err.trim().slice(0, 200)}`);
				return text;
			})(),
			new Promise<never>((_, rej) => {
				timer = setTimeout(() => rej(new Error(`${basename(cmd[0] ?? "")}: no answer in ${ms} ms`)), ms);
			}),
		]);
	} finally {
		clearTimeout(timer);
		if (proc.exitCode === null) proc.kill();
	}
}
const readAny = (path: string) => within(readFile(path, "utf8"), READ_TIMEOUT_MS, basename(path));
/** This workspace's Claude Code transcripts: ~/.claude/projects/<workspace path, ":\/" → "-">. */
const CLAUDE_PROJECTS = resolve(process.env["INFO_CLAUDE_PROJECTS"] ?? join(homedir(), ".claude", "projects"));
const transcriptsSlug = () => defaultWorkspace().replace(/[:\\/]/g, "-").toLowerCase();
/** Subagents active in the last 24 h, from their .meta.json and the transcript's mtime only. */
async function agents(now: number): Promise<{ rows: Activity["agents"]; error: string | null }> {
	try {
		const slug = transcriptsSlug();
		const dir = (await within(readdir(CLAUDE_PROJECTS), READ_TIMEOUT_MS, "claude projects")).find((n) => n.toLowerCase() === slug);
		if (!dir) return { rows: [], error: null };
		const root = join(CLAUDE_PROJECTS, dir);
		const sessions = (await within(readdir(root, { withFileTypes: true }), READ_TIMEOUT_MS, "sessions")).filter((d) => d.isDirectory() && /^[0-9a-f-]{36}$/.test(d.name));
		const rows: Activity["agents"] = [];
		for (const s of sessions) {
			const sub = join(root, s.name, "subagents");
			const names = await within(readdir(sub), READ_TIMEOUT_MS, "subagents").catch(() => [] as string[]);
			const metas = names.filter((n) => n.endsWith(".meta.json"));
			const timed = await Promise.all(metas.map(async (m) => ({ m, t: await mtimeOf(join(sub, m.replace(/\.meta\.json$/, ".jsonl"))) })));
			const recent = timed.filter((r) => r.t && now - r.t <= WINDOW_MS).sort((a, b) => b.t - a.t).slice(0, ACTIVITY_LIMIT.agents);
			for (const { m, t } of recent) {
				const meta = await readAny(join(sub, m)).then((x) => JSON.parse(x) as unknown, () => null);
				const row = agentRow(meta, t, now);
				if (row) rows.push(row);
			}
		}
		return { rows: rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LIMIT.agents), error: null };
	} catch (e) {
		return { rows: [], error: redact((e as Error).message) };
	}
}
/** Port and file pins, probed by the slow refresher: key → { ok, reason, file }. */
let pinProbe = new Map<string, { ok: boolean; reason: string | null; file: string | null }>();
async function probePins(): Promise<void> {
	const specs = pinSpecs((snap.now as { pinned?: unknown } | null)?.pinned);
	const next = new Map<string, { ok: boolean; reason: string | null; file: string | null }>();
	await Promise.all(
		specs.map(async (s) => {
			if (s.kind === "port") {
				const up = await probe(s.port!);
				next.set(s.key, { ok: up, reason: up ? null : `nothing is listening on port ${s.port} (start the dev server)`, file: null });
			} else if (s.kind === "file") {
				const f = await within(newestFile(defaultWorkspace(), s.dir!, s.glob!), READ_TIMEOUT_MS, s.dir!).catch(() => null);
				next.set(s.key, { ok: !!f, reason: f ? null : `no file matching ${s.glob} in ${s.dir}`, file: f });
			}
		}),
	);
	pinProbe = next;
}
/** Every pin as the navbar draws it; artifact pins follow the content snapshot. */
function pinStates(): PinState[] {
	return pinSpecs((snap.now as { pinned?: unknown } | null)?.pinned).map((s): PinState => {
		const base = { key: s.key, kind: s.kind, icon: s.icon };
		if (s.kind === "artifact") {
			const a = find(s.id!);
			const ok = !!a && !!snap.mtimes.get(a.id);
			return { ...base, label: s.label ?? a?.title ?? s.id!, href: ok ? `/view/${s.id}` : null, ok, reason: ok ? null : a ? "its file is missing" : "not in artifacts.json", external: false };
		}
		if (s.kind === "url") return { ...base, label: s.label ?? s.url!, href: s.url!, ok: true, reason: null, external: true };
		const pr = pinProbe.get(s.key);
		const href = s.kind === "port" ? `http://localhost:${s.port}${s.path ?? "/"}` : `/files/pinned/${s.key}`;
		return { ...base, label: s.label ?? s.key, href: pr?.ok ? href : null, ok: !!pr?.ok, reason: pr ? pr.reason : "not checked yet", external: true };
	});
}
/** One slow refresh (usage + activity + pins), single-flight; the Claude command keeps its own 5-minute timer. */
export function refreshSlow(): Promise<void> {
	if (slowRunning) return slowRunning;
	slowRunning = (async () => {
		const t = Date.now();
		await probePins().catch(() => {});
		const [u, git, ag] = await Promise.all([
			refreshUsage(snap.usageConfig, usage, { readText: readAny, run }, t).catch(() => usage),
			run(["git", "-C", defaultWorkspace(), "log", "--all", "--since=24.hours", `-n${ACTIVITY_LIMIT.commits}`, "--pretty=format:%h%x09%cI%x09%s"], 10_000).then(
				(out) => ({ rows: parseGit(out), error: null as string | null }),
				(e) => ({ rows: [] as Activity["commits"], error: redact((e as Error).message) }),
			),
			agents(t),
		]);
		usage = u;
		activity = {
			reports: writeupRows(snap.writeups.reports, t, ACTIVITY_LIMIT.reports),
			handoffs: writeupRows(snap.writeups.handoffs, t, ACTIVITY_LIMIT.handoffs),
			commits: git.rows,
			agents: ag.rows,
		};
		const at = new Date(t).toISOString();
		activitySources = [
			{ name: "git log", ok: !git.error, as_of_utc: git.error ? null : at, stale: !!git.error, error: git.error },
			{ name: "agent metadata", ok: !ag.error, as_of_utc: ag.error ? null : at, stale: !!ag.error, error: ag.error },
		];
		slowAt = Date.now();
	})().finally(() => {
		slowRunning = null;
	});
	return slowRunning;
}
/** A slow source is stale when the slow refresher has not finished for 3 periods. */
const slowStale = () => !slowAt || Date.now() - slowAt > 3 * SLOW_MS + 30_000;

// ── responses ────────────────────────────────────────────────────────────
async function send(file: string, extra: Record<string, string> = {}): Promise<Response> {
	const f = Bun.file(file);
	if (!(await f.exists())) return new Response("not found", { status: 404 });
	return new Response(f, {
		headers: { "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", ...SECURITY, ...extra },
	});
}
const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "Content-Type": MIME[".json"]!, "Cache-Control": "no-store", ...SECURITY } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The legacy frame: a Back bar over the original file, in the kit theme. */
function frame(a: Artifact): Response {
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)}</title><link rel="stylesheet" href="/kit/kit.css"></head>
<body class="kit-frame"><header class="kit-bar"><a class="kit-back" href="/artifacts">← Artifacts</a><b>${esc(a.title)}</b>
<span class="kit-chip">older format</span><a class="kit-standalone" href="/raw/${esc(a.id)}" target="_blank" rel="noopener">Open standalone</a></header>
<iframe src="/raw/${esc(a.id)}" title="${esc(a.title)}"></iframe></body></html>`;
	return new Response(html, { headers: { "Content-Type": MIME[".html"]!, ...SECURITY } });
}
/** The command that rebuilds a kit page, when its builder exists. */
export const rebuildCommand = (id: string) => (snap.builders.has(id) ? `bun tools/info-server/content/builders/${id}.ts` : null);
/** A registered page whose file is missing: say so, and how to rebuild it (never a bare 404). */
function notBuilt(a: Artifact): Response {
	const cmd = a.kind === "kit" ? rebuildCommand(a.id) : null;
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)}: not built yet</title><link rel="stylesheet" href="/kit/kit.css"></head>
<body><header class="kit-bar"><a class="kit-back" href="/artifacts">← Artifacts</a><b>${esc(a.title)}</b></header>
<main class="kit-page"><div class="kit-answer" data-not-built><p>Not built yet.</p>
<p>${cmd ? `Rebuild with: <code>${esc(cmd)}</code>` : a.kind === "kit" ? "No builder found in content/builders/." : `The file is missing: <code>${esc(a.path)}</code>`}</p></div></main></body></html>`;
	return new Response(html, { status: 404, headers: { "Content-Type": MIME[".html"]!, "Cache-Control": "no-store", ...SECURITY } });
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
	if (!path) return json({ error: "unknown report" }, 404);
	try {
		return json({ name, index_md: await within(readFile(path, "utf8"), READ_TIMEOUT_MS, file) });
	} catch (e) {
		return json({ name, index_md: null, error: (e as Error).message });
	}
}

// ── the one write route ──────────────────────────────────────────────────
const answerLog = new AnswerLog(() => join(CONTENT, ANSWERS));
/** POST /api/answer: Origin must be this server (a page on another site cannot post), JSON ≤ 4 KB. */
async function postAnswer(req: Request): Promise<Response> {
	const origin = req.headers.get("origin");
	const ok = [`http://localhost:${port()}`, `http://127.0.0.1:${port()}`];
	if (!origin || !ok.includes(origin)) return json({ error: "forbidden origin" }, 403);
	if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return json({ error: "Content-Type must be application/json" }, 415);
	const declared = Number(req.headers.get("content-length") ?? "0");
	if (declared > MAX_BODY) return json({ error: `body over ${MAX_BODY} bytes` }, 413);
	let body: unknown;
	try {
		const buf = await req.arrayBuffer();
		if (buf.byteLength > MAX_BODY) return json({ error: `body over ${MAX_BODY} bytes` }, 413);
		body = JSON.parse(new TextDecoder().decode(buf));
	} catch {
		return json({ error: "body is not JSON" }, 400);
	}
	if (!snap.at) return json({ error: "warming up" }, 503);
	const v = validate(body, snap.plans);
	if (!v.ok) return json({ error: v.error }, v.status);
	if (!existsSync(CONTENT)) return json({ error: "no content folder" }, 500);
	try {
		const r = await answerLog.append(v.row);
		void refresh(); // the item turns answered on the next /api/plans, not a refresh tick later
		return json({ id: r.id, duplicate: r.duplicate, line: v.row.line }, r.duplicate ? 200 : 201);
	} catch (e) {
		return json({ error: `could not record the answer: ${redact((e as Error).message)}` }, 500);
	}
}

const find = (id: string | null) => snap.manifest.artifacts.find((x) => x.id === id);
/** The app's own routes: each serves home.html, which renders the section from the path. */
const APP_ROUTES = new Set(["/", "/index.html", "/stages", "/artifacts"]);
const slowSources = (names: string[]) => [...usage.sources, ...activitySources].filter((s) => names.includes(s.name)).map((s) => ({ ...s, stale: s.stale || slowStale() }));

export async function handle(req: Request): Promise<Response> {
	const host = (req.headers.get("host") ?? "").split(":")[0];
	const url = new URL(req.url);
	const p = decodeURIComponent(url.pathname);
	if (req.method === "POST" && p === "/api/answer") {
		if (host !== "localhost" && host !== "127.0.0.1") return new Response("local only", { status: 403 });
		return postAnswer(req);
	}
	if (req.method !== "GET" && req.method !== "HEAD") return new Response("read-only", { status: 405 });
	if (host !== "localhost" && host !== "127.0.0.1") return new Response("local only", { status: 403 });

	// The API answers from memory only.
	if (p === "/api/health") return json(health());
	if (p.startsWith("/api/") && !snap.at) return json({ error: "warming up", retry_ms: 500 }, 503);
	if (p === "/api/now") return json(snap.now);
	if (p === "/api/glossary") return json(snap.glossary);
	if (p === "/api/artifacts") {
		const m = snap.manifest;
		const modified = (a: Artifact) => {
			const t = snap.mtimes.get(a.id) ?? 0;
			return t ? new Date(t).toISOString() : null;
		};
		return json({ ...m, artifacts: m.artifacts.map((a) => ({ ...a, modified: modified(a), rebuild: modified(a) ? null : rebuildCommand(a.id) })) });
	}
	if (p === "/api/mtime") return json({ mtime: snap.mtimes.get(url.searchParams.get("id") ?? "") ?? 0 });
	if (p === "/api/plans") return json({ plans: snap.plans, default: snap.defaultPlan });
	if (p === "/api/plan") return json(snap.plans.find((x) => x.id === snap.defaultPlan) ?? snap.plans[0]);
	if (p === "/api/report") return report(url.searchParams.get("name") ?? "");
	if (p === "/api/usage") return json({ data: usage.data, sources: slowSources(["claude-usage", "fw-cost.json", "glm-usage.json"]) });
	if (p === "/api/activity") return json({ data: activity, sources: [sources()[0], ...slowSources(["git log", "agent metadata"])] });
	if (p === "/api/answers") return json(answerState(snap.answers, snap.delivered, snap.reopened));
	if (p === "/api/pinned") return json(pinStates());
	if (p.startsWith("/api/")) return json({ error: "not found" }, 404);

	// Files are streamed by Bun (async), never read synchronously on the event loop.
	if (APP_ROUTES.has(p)) return send(join(ROOT, "home.html"), { "Cache-Control": "no-store" });
	if (p.startsWith("/files/pinned/")) {
		// Only the newest file the slow refresher matched for a configured file pin, never a path from the URL.
		const f = pinProbe.get(p.slice(14))?.file;
		return f ? send(f, { "Cache-Control": "no-store", "Content-Disposition": "inline" }) : new Response("no such pin", { status: 404 });
	}
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
		const file = fileOf(a);
		if (mode === "view") return !(await Bun.file(file).exists()) ? notBuilt(a) : a.kind === "kit" ? Response.redirect(`/a/${id}/`, 302) : frame(a);
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
	// The slow refresher (usage, activity) starts after the server is up and never delays a request.
	setTimeout(() => void refreshSlow(), 500);
	setInterval(() => void refreshSlow(), SLOW_MS);
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
