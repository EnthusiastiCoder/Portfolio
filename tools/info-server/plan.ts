// The plans for the home page: workstreams (steps) with status, dependencies and subtasks.
//
// Source, first that exists:
//   1. content/plans/<id>.json, one file per plan (ordered by now.json `plans`); home shows one at a
//      time with a switcher, All stages shows them all;
//   2. content/plan.json, a single plan (the schema is in INFO-SERVER.md);
//   3. otherwise now.json's `status` list, one step per entry, in order, with no dependencies.
// Each step's "latest report" is resolved from the workspace's report folders
// (plans/reports/<YYYY-MM-DDTHH-MM-SS>_<agent>/index.md), newest first, by the step's agent names;
// a handoff (plans/handoffs/<YYYY-MM-DDTHH-MM-SS>_<agent>_<n>.md) is the fallback.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
	/** sha1 of the question and its option labels: an answer names the exact question it answers. */
	hash: string;
}
/** The page's answer to an item's CURRENT question (joined from answers.jsonl by the server, answers.ts
 *  joinAnswers): the item still says "owner" in its content, but it no longer waits on the owner. */
export interface ItemAnswer {
	id: string;
	at: string;
	line: string;
	choice: string | null;
	other: string | null;
	/** When the answers hook handed it to a turn; null = sent, not yet delivered. */
	delivered_at: string | null;
}
/** An item asked again after an answer: an agent reopened that answer (answers.reopened.jsonl), or the
 *  question changed since (a new hash). It waits on the owner again; `note` says why. */
export interface ItemReopened {
	why: "reopened" | "asked_again";
	/** When the agent reopened it; null for a changed question. */
	at: string | null;
	note: string | null;
	/** The earlier answer that no longer holds. */
	previous: { line: string; at: string };
}
export interface Subtask {
	id: string;
	title: string;
	status: Status;
	note: string | null;
	question: Question | null;
	answer: ItemAnswer | null;
	reopened: ItemReopened | null;
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
	answer: ItemAnswer | null;
	reopened: ItemReopened | null;
	updated: string | null;
	depends_on: string[];
	subtasks: Subtask[];
	agent: string | null;
	/** "report:<folder>" or "handoff:<file>", or null. */
	report: string | null;
	plan_section: string | null;
}
export interface Plan {
	/** The plan's id: its file name in content/plans/, or "current" for plan.json / now.json. */
	id: string;
	title: string | null;
	/** A short name for the plan switcher ("Showcase"); the title when absent. */
	short: string | null;
	plan_file: string | null;
	updated: string | null;
	active: string | null;
	steps: Step[];
	source: "plans" | "plan.json" | "now.json" | null;
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
	return { text, options, hash: questionHash(text, options) };
}
export const questionHash = (text: string, options: Option[]) =>
	createHash("sha1").update([text, ...options.map((o) => o.label)].join("\n")).digest("hex");
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
		answer: null,
		reopened: null,
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
		answer: null,
		reopened: null,
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
		return { id: "current", title: str(p["title"]), short: str(p["short"]), plan_file: str(p["plan_file"]), updated: iso(p["updated"]), active, steps, source: "plan.json" };
	}
	const n = now as { focus?: string; updated?: string; status?: Array<{ label?: string; state?: string; note?: string; link?: string; question?: string; options?: unknown[] }> } | null;
	if (!n || !Array.isArray(n.status)) return { id: "current", title: n?.focus ?? null, short: null, plan_file: null, updated: iso(n?.updated), active: null, steps: [], source: null };
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
			answer: null,
			reopened: null,
			updated: iso(n.updated),
			depends_on: [],
			subtasks: [],
			agent: null,
			report: null,
			plan_section: null,
		};
	});
	const active = steps.find((s) => s.status === "running" || s.status === "owner")?.id ?? null;
	return { id: "current", title: n.focus ?? null, short: null, plan_file: null, updated: iso(n.updated), active, steps, source: "now.json" };
}

/** Problems in a plan file, for check.ts. `file` names it in each message (plan.json, plans/x.json). */
export function planProblems(raw: unknown, file = "plan.json"): string[] {
	return planProblemsOf(raw).map((m) => m.replace(/^plan\.json/, file));
}
function planProblemsOf(raw: unknown): string[] {
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

// ── several plans ─────────────────────────────────────────────────────────
/** A plan id is its file name in content/plans/ (<id>.json). */
export const PLAN_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
export const PLAN_FILE = /^[a-z0-9][a-z0-9-]{0,47}\.json$/;

/** Every plan, in order: content/plans/<id>.json files ordered by now.json `plans` (others after, by
 *  name); else plan.json; else now.json's status list. `files` = [{ id, raw }] already parsed. */
export function buildPlans(files: Array<{ id: string; raw: unknown }>, planJson: unknown, now: unknown, w: Writeups, artifactIds: string[] = []): Plan[] {
	const good = files.filter((f) => PLAN_ID.test(f.id) && f.raw && typeof f.raw === "object" && Array.isArray((f.raw as Record<string, unknown>)["steps"]));
	if (good.length) {
		const order = (now as { plans?: unknown } | null)?.plans;
		const rank = (id: string) => {
			const i = Array.isArray(order) ? order.indexOf(id) : -1;
			return i < 0 ? Number.MAX_SAFE_INTEGER : i;
		};
		return good
			.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
			.map((f) => ({ ...buildPlan(f.raw, now, w, artifactIds), id: f.id, source: "plans" as const }));
	}
	return [buildPlan(planJson, now, w, artifactIds)];
}

/** One item waiting on the owner: the most specific one (a parent counts only when nothing under it is
 *  "owner" in the content, answered or not). An answered item (its current question has an answer from
 *  the page that no agent reopened) does not wait: it is not counted, and neither is its parent. */
export interface OwnerItem {
	plan: string;
	step: Step;
	subtask: Subtask | null;
}
/** Waits on the owner now: "owner" in the content and not answered. Content "done" always wins. */
export const waitsOnOwner = (x: { status: Status; answer: ItemAnswer | null }) => x.status === "owner" && !x.answer;
export function ownerItems(plan: Plan): OwnerItem[] {
	const out: OwnerItem[] = [];
	/** Returns whether anything under `subs` is "owner" in the content (answered or not). */
	const walk = (step: Step, subs: Subtask[]): boolean => {
		let any = false;
		for (const s of subs) {
			const below = walk(step, s.children);
			if (s.status === "owner" && !below && waitsOnOwner(s)) out.push({ plan: plan.id, step, subtask: s });
			any ||= below || s.status === "owner";
		}
		return any;
	};
	for (const st of plan.steps) {
		const below = walk(st, st.subtasks);
		if (!below && waitsOnOwner(st)) out.push({ plan: plan.id, step: st, subtask: null });
	}
	return out;
}
/** Items whose current question the owner answered on the page (Claude is acting on it). */
export function answeredItems(plan: Plan): OwnerItem[] {
	const out: OwnerItem[] = [];
	const walk = (step: Step, subs: Subtask[]) => {
		for (const s of subs) {
			if (s.status === "owner" && s.answer) out.push({ plan: plan.id, step, subtask: s });
			walk(step, s.children);
		}
	};
	for (const st of plan.steps) {
		if (st.status === "owner" && st.answer) out.push({ plan: plan.id, step: st, subtask: null });
		walk(st, st.subtasks);
	}
	return out;
}
/** The plan shown first: the first with something waiting on you, else the most recently updated. */
export function defaultPlan(plans: Plan[]): string | null {
	const owner = plans.find((p) => ownerItems(p).length);
	if (owner) return owner.id;
	const latest = [...plans].sort((a, b) => String(b.updated ?? "").localeCompare(String(a.updated ?? "")))[0];
	return latest?.id ?? null;
}
/** A step, or a subtask anywhere under it, by id. */
export function findItem(plans: Plan[], planId: string, stepId: string, subtaskId: string | null): { plan: Plan; step: Step; subtask: Subtask | null } | null {
	const plan = plans.find((p) => p.id === planId);
	const step = plan?.steps.find((s) => s.id === stepId);
	if (!plan || !step) return null;
	if (!subtaskId) return { plan, step, subtask: null };
	const find = (subs: Subtask[]): Subtask | null => {
		for (const s of subs) {
			if (s.id === subtaskId) return s;
			const c = find(s.children);
			if (c) return c;
		}
		return null;
	};
	const subtask = find(step.subtasks);
	return subtask ? { plan, step, subtask } : null;
}

/** Reads every plan from a content folder synchronously (check.ts and the answers hook, never the server). */
export function loadPlansSync(contentDir: string, w: Writeups = { reports: [], handoffs: [] }): Plan[] {
	const json = (f: string) => {
		try {
			return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as unknown) : null;
		} catch {
			return null;
		}
	};
	const dir = join(contentDir, "plans");
	const files = existsSync(dir)
		? readdirSync(dir)
				.filter((n) => PLAN_FILE.test(n))
				.map((n) => ({ id: n.slice(0, -5), raw: json(join(dir, n)) }))
		: [];
	return buildPlans(files, json(join(contentDir, "plan.json")), json(join(contentDir, "now.json")), w);
}
