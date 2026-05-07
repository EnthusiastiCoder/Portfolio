// The current plan for the home page: workstreams (steps) with status, dependencies and subtasks.
//
// Source, first that exists:
//   1. content/plan.json, which agents update (the schema is in INFO-SERVER.md);
//   2. otherwise now.json's `status` list, one step per entry, in order, with no dependencies.
// Each step's "latest report" is resolved from the workspace's report folders
// (plans/reports/<YYYY-MM-DDTHH-MM-SS>_<agent>/index.md), newest first, by the step's agent names;
// a handoff (plans/handoffs/<YYYY-MM-DDTHH-MM-SS>_<agent>_<n>.md) is the fallback.

export const STATUSES = ["done", "running", "waiting", "owner", "not_started", "failed"] as const;
export type Status = (typeof STATUSES)[number];
/** Other spellings accepted in plan.json, and now.json's states mapped onto plan statuses. */
const ALIASES: Record<string, Status> = {
	waiting_owner: "owner",
	doing: "running",
	todo: "not_started",
	blocked: "failed",
};
/** now.json's `waiting` means waiting on you (INFO-SERVER.md); in plan.json `waiting` is waiting on others. */
const NOW_STATE: Record<string, Status> = { done: "done", doing: "running", waiting: "owner", blocked: "failed", todo: "not_started" };
const MAX_DEPTH = 4;
export const REPORT_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[A-Za-z0-9._-]+$/;
export const HANDOFF_NAME = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})_([A-Za-z0-9._-]+?)(?:_\d+)?\.md$/;

/** One answer the owner can pick; `recommended` marks the suggested one. */
export interface Option {
	label: string;
	recommended: boolean;
	note: string | null;
}
/** What a needs-you item asks the owner: required on every item waiting on you (check.ts). */
export interface Question {
	text: string;
	options: Option[];
}
export interface Subtask {
	id: string;
	title: string;
	status: Status;
	note: string | null;
	question: Question | null;
	children: Subtask[];
	depends_on: string[];
}
export interface Step {
	id: string;
	name: string;
	goal: string;
	status: Status;
	waiting_on: string | null;
	link: string | null;
	note: string | null;
	question: Question | null;
	updated: string | null;
	depends_on: string[];
	subtasks: Subtask[];
	agent: string | null;
	/** "report:<folder>" or "handoff:<file>", or null. */
	report: string | null;
	plan_section: string | null;
}
export interface Plan {
	title: string | null;
	plan_file: string | null;
	updated: string | null;
	active: string | null;
	steps: Step[];
	source: "plan.json" | "now.json" | null;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
export const status = (v: unknown): Status => {
	const s = typeof v === "string" ? (ALIASES[v] ?? v) : v;
	return (STATUSES as readonly unknown[]).includes(s) ? (s as Status) : "not_started";
};
/** Only same-app paths ("/view/x"): the file is agent-written and must not inject external URLs. */
const link = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : null);
const iso = (v: unknown) => {
	const t = typeof v === "string" ? Date.parse(v) : Number.NaN;
	return Number.isNaN(t) ? null : new Date(t).toISOString();
};

/** `question` + `options` from an item: options are strings or { label, recommended, note }. */
export function question(r: Record<string, unknown>): Question | null {
	const text = typeof r["question"] === "string" ? r["question"].trim() : "";
	if (!text) return null;
	const options = (Array.isArray(r["options"]) ? r["options"] : [])
		.map((o): Option | null => {
			if (typeof o === "string") return o.trim() ? { label: o.trim(), recommended: false, note: null } : null;
			const x = o as Record<string, unknown> | null;
			return x && typeof x === "object" && str(x["label"]) ? { label: String(x["label"]), recommended: x["recommended"] === true, note: str(x["note"]) } : null;
		})
		.filter((o): o is Option => !!o);
	return { text, options };
}
/** Problems with a needs-you item's question, for check.ts. `where` names the item in the message. */
export function questionProblems(r: Record<string, unknown>, where: string): string[] {
	const q = question(r);
	if (!q) return [`${where}: needs you but has no question (add "question": "…?" and, where there is a choice, "options")`];
	const out: string[] = [];
	if (!q.text.endsWith("?")) out.push(`${where}: question must end with "?"`);
	if (Array.isArray(r["options"]) && q.options.length !== r["options"].length) out.push(`${where}: each option must be a string or { "label": "…" }`);
	if (q.options.length === 1) out.push(`${where}: a single option is not a choice: give 2 or more, or none`);
	if (q.options.filter((o) => o.recommended).length > 1) out.push(`${where}: at most one option may be recommended`);
	return out;
}

function subtasks(raws: unknown, depth = 0): Subtask[] {
	const rows = Array.isArray(raws) ? raws.map((r) => subtask(r, depth)).filter((r): r is Subtask => !!r) : [];
	const ids = new Set(rows.map((r) => r.id));
	for (const r of rows) r.depends_on = r.depends_on.filter((d) => ids.has(d) && d !== r.id);
	return rows;
}
function subtask(raw: unknown, depth: number): Subtask | null {
	const r = raw as Record<string, unknown> | null;
	if (!r || typeof r !== "object" || !r["id"] || !r["title"]) return null;
	return {
		id: String(r["id"]),
		title: String(r["title"]),
		status: status(r["status"]),
		note: str(r["note"]),
		question: question(r),
		children: depth < MAX_DEPTH ? subtasks(r["children"], depth + 1) : [],
		depends_on: Array.isArray(r["depends_on"]) ? r["depends_on"].map(String) : [],
	};
}

export interface Writeups {
	/** Report folder names, newest first. */
	reports: string[];
	/** Handoff file names, newest first. */
	handoffs: string[];
}
function latest(names: string[], w: Writeups): string | null {
	const want = new Set(names);
	const r = w.reports.find((n) => want.has(n.split("_").slice(1).join("_")));
	if (r) return `report:${r}`;
	const h = w.handoffs.find((n) => want.has(HANDOFF_NAME.exec(n)?.[2] ?? ""));
	return h ? `handoff:${h}` : null;
}

function step(raw: unknown, w: Writeups): Step | null {
	const r = raw as Record<string, unknown> | null;
	if (!r || typeof r !== "object" || !r["id"] || !r["name"]) return null;
	const names = (Array.isArray(r["agents"]) ? r["agents"] : r["agent"] ? [r["agent"]] : []).filter((n): n is string => typeof n === "string" && !!n);
	const own = str(r["report"]);
	const explicit = own && w.reports.includes(own) ? `report:${own}` : own && w.handoffs.includes(own) ? `handoff:${own}` : null;
	return {
		id: String(r["id"]),
		name: String(r["name"]),
		goal: str(r["goal"]) ?? "",
		status: status(r["status"]),
		waiting_on: str(r["waiting_on"]),
		link: link(r["link"]),
		note: str(r["note"]),
		question: question(r),
		updated: iso(r["updated"]),
		depends_on: Array.isArray(r["depends_on"]) ? r["depends_on"].filter((d): d is string => typeof d === "string") : [],
		subtasks: subtasks(r["subtasks"]),
		agent: names.at(-1) ?? null,
		report: explicit ?? latest(names, w),
		plan_section: str(r["plan_section"]),
	};
}

/** The plan from plan.json (`raw`), or derived from now.json when there is none. */
export function buildPlan(raw: unknown, now: unknown, w: Writeups, artifactIds: string[] = []): Plan {
	const p = raw as Record<string, unknown> | null;
	if (p && typeof p === "object" && Array.isArray(p["steps"])) {
		const steps = p["steps"].map((s) => step(s, w)).filter((s): s is Step => !!s);
		const ids = new Set(steps.map((s) => s.id));
		for (const s of steps) s.depends_on = s.depends_on.filter((d) => ids.has(d) && d !== s.id);
		const active = ids.has(p["active"] as string) ? (p["active"] as string) : (steps.find((s) => s.status === "running" || s.status === "owner")?.id ?? null);
		return { title: str(p["title"]), plan_file: str(p["plan_file"]), updated: iso(p["updated"]), active, steps, source: "plan.json" };
	}
	const n = now as { focus?: string; updated?: string; status?: Array<{ label?: string; state?: string; note?: string; link?: string; question?: string; options?: unknown[] }> } | null;
	if (!n || !Array.isArray(n.status)) return { title: n?.focus ?? null, plan_file: null, updated: iso(n?.updated), active: null, steps: [], source: null };
	const letters = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `S${i + 1}`);
	const steps: Step[] = n.status.map((s, i) => {
		// A note that names a registered artifact links the step to it ("your sign-off: repo-audit").
		const named = artifactIds.find((id) => new RegExp(`(^|[^a-z0-9-])${id}($|[^a-z0-9-])`).test(s.note ?? ""));
		return {
			id: letters(i),
			name: s.label ?? `Step ${i + 1}`,
			goal: "",
			status: NOW_STATE[s.state ?? ""] ?? status(s.state),
			waiting_on: s.state === "waiting" ? "you" : null,
			link: link(s.link) ?? (named ? `/view/${named}` : null),
			note: s.note ?? null,
			question: question(s as Record<string, unknown>),
			updated: iso(n.updated),
			depends_on: [],
			subtasks: [],
			agent: null,
			report: null,
			plan_section: null,
		};
	});
	const active = steps.find((s) => s.status === "running" || s.status === "owner")?.id ?? null;
	return { title: n.focus ?? null, plan_file: null, updated: iso(n.updated), active, steps, source: "now.json" };
}

/** Problems in a plan.json, for check.ts. */
export function planProblems(raw: unknown): string[] {
	const out: string[] = [];
	const p = raw as Record<string, unknown> | null;
	if (!p || typeof p !== "object" || !Array.isArray(p["steps"])) return ["plan.json: needs a steps list"];
	const ids = new Set<string>();
	for (const s of p["steps"] as Array<Record<string, unknown>>) {
		if (!s?.["id"] || !s?.["name"]) out.push("plan.json: a step without id or name");
		const id = String(s?.["id"]);
		if (ids.has(id)) out.push(`plan.json: duplicate step ${id}`);
		ids.add(id);
		if (s?.["status"] && status(s["status"]) !== (ALIASES[s["status"] as string] ?? s["status"])) out.push(`plan.json ${id}: unknown status ${s["status"]}`);
		if (s?.["link"] && !link(s["link"])) out.push(`plan.json ${id}: link must be a same-app path like /view/<id>`);
		if (s && status(s["status"]) === "owner") out.push(...questionProblems(s, `plan.json ${id}`));
		const subs = (list: unknown, path: string, depth: number): void => {
			for (const t of Array.isArray(list) ? (list as Array<Record<string, unknown>>) : []) {
				if (!t || typeof t !== "object") continue;
				const at = `${path}/${String(t["id"])}`;
				if (status(t["status"]) === "owner") out.push(...questionProblems(t, `plan.json ${at}`));
				if (depth < MAX_DEPTH) subs(t["children"], at, depth + 1);
			}
		};
		subs(s?.["subtasks"], id, 0);
	}
	for (const s of p["steps"] as Array<Record<string, unknown>>)
		for (const d of (s?.["depends_on"] as string[]) ?? []) if (!ids.has(d)) out.push(`plan.json ${s["id"]}: depends on unknown step ${d}`);
	return out;
}
