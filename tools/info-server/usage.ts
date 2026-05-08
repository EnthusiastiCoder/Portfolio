// The usage strip's data: Claude (session + weekly), Fireworks this week (total + this project's
// share) and GLM / Z.ai (5-hour window + weekly). Account-wide numbers, read by the server's slow
// refresher (never by a request) from the sources named in content/usage.json:
//
//   { "claude":    { "command": ["python", "<path>/claude_usage.py", "--json"], "every_s": 300 }
//                    or { "file": "<path>/claude-usage.json" }            (a JSON with a `limits` list)
//     "fireworks": { "file": "<path>/fw-cost.json", "project": "Portofolio", "share_usd": 0,
//                    "exclude_models": ["deepseek-v4p1-flash"] }         (share_usd null = computed)
//     "glm":       { "file": "<path>/glm-usage.json" } }
//
// A group with no source, or a source that fails, shows "not measured", never 0. Each group reports a
// source row { name, ok, as_of_utc, stale, error } (stale after 900 s), as every envelope does.
import { redact } from "./safety";

export const STALE_AFTER_S = 900;
export interface Source {
	name: string;
	ok: boolean;
	as_of_utc: string | null;
	stale: boolean;
	error: string | null;
}
export type Level = "ok" | "amber" | "red" | "unknown";
export interface Meter {
	label: string;
	percent: number | null;
	resets_at: string | null;
	level: Level;
}
export interface Usage {
	claude: { session: Meter; weekly: Meter; as_of_utc: string | null } | null;
	fireworks: {
		total_usd: number | null;
		cap_usd: number | null;
		project: string;
		share_usd: number | null;
		share_pct: number | null;
		level: Level;
		week_start_utc: string | null;
		resets_utc: string | null;
		by_model: Array<{ model: string; usd: number }>;
		as_of_utc: string | null;
	} | null;
	glm: { window: Meter; weekly: Meter; tier: string | null; as_of_utc: string | null } | null;
}
export interface UsageConfig {
	claude?: { command?: string[]; file?: string; every_s?: number };
	fireworks?: { file?: string; project?: string; share_usd?: number | null; exclude_models?: string[] };
	glm?: { file?: string };
}

/** ≥ 80 % amber, ≥ 100 % red; an API severity above "normal" raises it. */
export function level(percent: number | null, severity?: unknown): Level {
	if (percent == null || !Number.isFinite(percent)) return "unknown";
	const band: Level = percent >= 100 ? "red" : percent >= 80 ? "amber" : "ok";
	const sev = typeof severity === "string" ? severity.toLowerCase() : "";
	const fromSev: Level = /critical|exceeded|blocked|red/.test(sev) ? "red" : /warn|high|amber/.test(sev) ? "amber" : "ok";
	const rank = { ok: 0, unknown: 0, amber: 1, red: 2 };
	return rank[fromSev] > rank[band] ? fromSev : band;
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (v: unknown) => {
	const t = typeof v === "string" ? Date.parse(v) : Number.NaN;
	return Number.isNaN(t) ? null : new Date(t).toISOString();
};
const stale = (asOf: string | null, now: number) => !asOf || now - Date.parse(asOf) > STALE_AFTER_S * 1000;
const meter = (label: string, percent: number | null, resets: unknown, severity?: unknown): Meter => ({
	label,
	percent,
	resets_at: iso(resets),
	level: level(percent, severity),
});
const unmeasured = (label: string): Meter => ({ label, percent: null, resets_at: null, level: "unknown" });

/** Claude: `limits` as claude_usage.py --json prints it (session, weekly_all). */
export function parseClaude(raw: unknown, asOf: string | null): Usage["claude"] {
	const r = raw as { limits?: Array<Record<string, unknown>>; as_of_utc?: string } | null;
	if (!r || !Array.isArray(r.limits)) return null;
	const pick = (kind: string) => r.limits!.find((l) => l["kind"] === kind);
	const s = pick("session");
	const w = pick("weekly_all");
	return {
		session: s ? meter("Session (5 h)", num(s["percent"]), s["resets_at"], s["severity"]) : unmeasured("Session (5 h)"),
		weekly: w ? meter("Weekly, all models", num(w["percent"]), w["resets_at"], w["severity"]) : unmeasured("Weekly, all models"),
		as_of_utc: iso(r.as_of_utc) ?? asOf,
	};
}
/** Fireworks: fw-cost.json's `week` block; the project's share is fixed (share_usd) or computed. */
export function parseFireworks(raw: unknown, cfg: NonNullable<UsageConfig["fireworks"]>): Usage["fireworks"] {
	const project = cfg.project ?? "This project";
	const fixed = cfg.share_usd === undefined ? 0 : cfg.share_usd;
	const r = raw as { week?: Record<string, unknown>; as_of_utc?: string } | null;
	const w = r?.week;
	const cap = num(w?.["cap_usd"]);
	const total = num(w?.["spent_usd"]);
	const byModel = Object.entries((w?.["by_model_usd"] as Record<string, number>) ?? {})
		.filter(([, u]) => typeof u === "number")
		.map(([model, usd]) => ({ model, usd }))
		.sort((a, b) => b.usd - a.usd);
	const excluded = new Set(cfg.exclude_models ?? []);
	const computed = total == null ? null : total - byModel.filter((m) => excluded.has(m.model)).reduce((a, m) => a + m.usd, 0);
	const share = fixed === null ? computed : fixed;
	const pct = share != null && cap ? (100 * share) / cap : null;
	return {
		total_usd: total,
		cap_usd: cap,
		project,
		share_usd: share,
		share_pct: pct,
		level: level(pct),
		week_start_utc: iso(w?.["week_start_utc"]),
		resets_utc: iso(w?.["resets_utc"]),
		by_model: byModel,
		as_of_utc: iso(r?.as_of_utc ?? w?.["as_of_utc"]),
	};
}
/** GLM / Z.ai: glm-usage.json's `limits` (window, weekly). */
export function parseGlm(raw: unknown): Usage["glm"] {
	const r = raw as { limits?: Array<Record<string, unknown>>; fetched_at?: string; tier?: string; ok?: boolean } | null;
	if (!r || !Array.isArray(r.limits)) return null;
	const pick = (name: string) => r.limits!.find((l) => l["name"] === name);
	const win = pick("window");
	const wk = pick("weekly");
	return {
		window: win ? meter("5-hour window", num(win["percent"]), win["resets_at"]) : unmeasured("5-hour window"),
		weekly: wk ? meter("Weekly", num(wk["percent"]), wk["resets_at"]) : unmeasured("Weekly"),
		tier: typeof r.tier === "string" ? r.tier : null,
		as_of_utc: iso(r.fetched_at),
	};
}

export interface Io {
	/** Reads a text file with a timeout (throws on failure; code ENOENT when missing). */
	readText: (path: string) => Promise<string>;
	/** Runs a command with a timeout and returns its stdout (throws on a non-zero exit). */
	run: (cmd: string[], ms: number) => Promise<string>;
}
export interface UsageState {
	data: Usage;
	sources: Source[];
	/** When the Claude command last ran (ms), so it runs every `every_s`, not every refresh. */
	claudeAt: number;
	claudeRaw: unknown;
	claudeError: string | null;
}
export const emptyUsage = (): UsageState => ({ data: { claude: null, fireworks: null, glm: null }, sources: [], claudeAt: 0, claudeRaw: null, claudeError: null });

const errText = (e: unknown) => redact((e as Error)?.message ?? String(e)) ?? "error";
async function readJsonFile(io: Io, path: string): Promise<unknown> {
	return JSON.parse(await io.readText(path));
}

/** One refresh of every usage group. `prev` keeps the last Claude reading between command runs. */
export async function refreshUsage(cfg: UsageConfig | null, prev: UsageState, io: Io, now = Date.now()): Promise<UsageState> {
	const next: UsageState = { ...prev, sources: [] };
	const src = (name: string, ok: boolean, asOf: string | null, error: string | null): Source => ({ name, ok, as_of_utc: asOf, stale: ok ? stale(asOf, now) : true, error });
	const tasks: Array<Promise<void>> = [];

	// Claude: a command on its own slower timer, or a file.
	const cl = cfg?.claude;
	if (cl?.command?.length) {
		const every = Math.max(60, cl.every_s ?? 300) * 1000;
		if (!prev.claudeAt || now - prev.claudeAt >= every || (prev.claudeError && now - prev.claudeAt >= 60_000)) {
			next.claudeAt = now;
			tasks.push(
				io.run(cl.command, 30_000).then(
					(out) => {
						next.claudeRaw = { ...(JSON.parse(out) as object), as_of_utc: new Date(now).toISOString() };
						next.claudeError = null;
					},
					(e) => {
						next.claudeError = errText(e);
					},
				),
			);
		}
	} else if (cl?.file) {
		tasks.push(
			readJsonFile(io, cl.file).then(
				(raw) => {
					next.claudeRaw = raw;
					next.claudeError = null;
				},
				(e) => {
					next.claudeError = errText(e);
				},
			),
		);
	}
	const fw = cfg?.fireworks;
	let fwRaw: unknown = null;
	let fwError: string | null = null;
	if (fw?.file)
		tasks.push(
			readJsonFile(io, fw.file).then(
				(raw) => {
					fwRaw = raw;
				},
				(e) => {
					fwError = errText(e);
				},
			),
		);
	const glm = cfg?.glm;
	let glmRaw: unknown = null;
	let glmError: string | null = null;
	if (glm?.file)
		tasks.push(
			readJsonFile(io, glm.file).then(
				(raw) => {
					glmRaw = raw;
				},
				(e) => {
					glmError = errText(e);
				},
			),
		);
	await Promise.all(tasks);

	if (cl) {
		const fileAsOf = (next.claudeRaw as { as_of_utc?: string } | null)?.as_of_utc ?? null;
		next.data = { ...next.data, claude: next.claudeRaw ? parseClaude(next.claudeRaw, iso(fileAsOf)) : null };
		next.sources.push(src("claude-usage", !next.claudeError && !!next.data.claude, next.data.claude?.as_of_utc ?? null, next.claudeError ?? (next.data.claude ? null : "no limits in the reading")));
	} else {
		next.data = { ...next.data, claude: null };
		next.sources.push(src("claude-usage", false, null, "not configured (content/usage.json claude)"));
	}
	if (fw) {
		// The project's fixed share still shows when the week total cannot be read.
		const f = parseFireworks(fwError ? null : fwRaw, fw);
		next.data = { ...next.data, fireworks: f };
		next.sources.push(src("fw-cost.json", !fwError && f?.total_usd != null, f?.as_of_utc ?? null, fwError ?? (f?.total_usd == null ? "no week block" : null)));
	} else {
		next.data = { ...next.data, fireworks: null };
		next.sources.push(src("fw-cost.json", false, null, "not configured (content/usage.json fireworks)"));
	}
	if (glm) {
		const g = glmError ? null : parseGlm(glmRaw);
		next.data = { ...next.data, glm: g };
		next.sources.push(src("glm-usage.json", !glmError && !!g, g?.as_of_utc ?? null, glmError ?? (g ? null : "no limits in the file")));
	} else {
		next.data = { ...next.data, glm: null };
		next.sources.push(src("glm-usage.json", false, null, "not configured (content/usage.json glm)"));
	}
	return next;
}

/** Problems in content/usage.json, for check.ts. */
export function usageProblems(raw: unknown): string[] {
	const out: string[] = [];
	const r = raw as Record<string, Record<string, unknown> | undefined> | null;
	if (!r || typeof r !== "object") return ["usage.json: must be an object"];
	for (const k of Object.keys(r)) if (!["claude", "fireworks", "glm"].includes(k)) out.push(`usage.json: unknown group "${k}" (claude|fireworks|glm)`);
	const cl = r["claude"];
	if (cl && !(Array.isArray(cl["command"]) && cl["command"].every((x) => typeof x === "string")) && typeof cl["file"] !== "string") out.push("usage.json claude: needs a command list or a file");
	const fw = r["fireworks"];
	if (fw && fw["share_usd"] !== undefined && fw["share_usd"] !== null && typeof fw["share_usd"] !== "number") out.push("usage.json fireworks: share_usd must be a number or null");
	if (fw && fw["file"] !== undefined && typeof fw["file"] !== "string") out.push("usage.json fireworks: file must be a path");
	const g = r["glm"];
	if (g && typeof g["file"] !== "string") out.push("usage.json glm: needs a file");
	return out;
}
