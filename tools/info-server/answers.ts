// Answers from the page: the info server's ONLY write path.
//
// POST /api/answer with { plan, item, subtask, question, choice, other, qhash } appends one line to
// content/answers.jsonl (never rewritten). The answers hook (answers-hook.ts) injects unread answers
// into the session's next turn and appends { id, delivered_at, session } to
// content/answers.delivered.jsonl. Unread = ids in answers minus ids in delivered.
//
// Guards (server.ts + here): localhost bind and Host; Origin must be this server; JSON only, ≤ 4 KB;
// the item must exist and wait on the owner NOW; qhash must match the question shown now (else 409:
// the question changed); choice must be one of its options, or `other` non-empty (≤ 500 chars).
// Writes are serialised (one queue) and an identical answer within 60 s returns the first id.
//
// The answered state (joinAnswers): a needs-you item whose CURRENT question hash has an answer is
// "answered" (Claude is acting on it): not counted as waiting on the owner, delivered or not. A new
// question (new hash) waits again; so does an answer an agent reopened by appending
// { id: <answer id>, at, note } to content/answers.reopened.jsonl (reopen.ts writes it). A content
// status other than "owner" (done, running...) always wins: only "owner" items are joined.
import { appendFile } from "node:fs/promises";
import { findItem, type ItemAnswer, type ItemReopened, type Plan, type Step, type Subtask } from "./plan";

export const ANSWERS = "answers.jsonl";
export const DELIVERED = "answers.delivered.jsonl";
export const REOPENED = "answers.reopened.jsonl";
/** A reopen note is short: it shows on the node. */
export const MAX_NOTE = 200;
export const MAX_BODY = 4096;
export const MAX_OTHER = 500;
const DEDUPE_MS = 60_000;

export interface AnswerRow {
	id: string;
	at: string;
	plan: string;
	item: string;
	subtask: string | null;
	title: string;
	question: string;
	choice: string | null;
	other: string | null;
	qhash: string;
	/** The paste-ready line: "<step>[.<subtask>] <title>: <choice or other>". */
	line: string;
}
export interface DeliveredRow {
	id: string;
	delivered_at: string;
	session: string | null;
}
/** An agent's marker: the answer `id` did not hold, ask the owner again. */
export interface ReopenedRow {
	id: string;
	at: string;
	note: string | null;
}

/** The ready-to-paste line, the same in the page's "Copy answer" and in the hook. */
export const answerLine = (item: string, subtask: string | null, title: string, choice: string | null, other: string | null) =>
	`${item}${subtask ? `.${subtask}` : ""} ${title}: ${choice ?? other ?? ""}`.trim();

/** Parses a jsonl file, skipping broken lines (a half-written last line never breaks the rest). */
export function jsonl<T>(text: string | null): T[] {
	const out: T[] = [];
	for (const l of (text ?? "").split(/\r?\n/)) {
		if (!l.trim()) continue;
		try {
			out.push(JSON.parse(l) as T);
		} catch {}
	}
	return out;
}

type Verdict = { ok: true; row: Omit<AnswerRow, "id" | "at"> } | { ok: false; status: number; error: string };
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Validates a parsed body against the plans as they are now. */
export function validate(body: unknown, plans: Plan[]): Verdict {
	const b = body as Record<string, unknown> | null;
	if (!b || typeof b !== "object" || Array.isArray(b)) return { ok: false, status: 400, error: "body must be a JSON object" };
	const allowed = new Set(["plan", "item", "subtask", "question", "choice", "other", "qhash"]);
	const extra = Object.keys(b).filter((k) => !allowed.has(k));
	if (extra.length) return { ok: false, status: 400, error: `unknown field(s): ${extra.join(", ")}` };
	const plan = s(b["plan"]);
	const item = s(b["item"]);
	const subtask = b["subtask"] == null ? null : s(b["subtask"]);
	if (!plan || !item) return { ok: false, status: 400, error: "plan and item are required" };
	const found = findItem(plans, plan, item, subtask);
	if (!found) return { ok: false, status: 404, error: `no item ${item}${subtask ? `.${subtask}` : ""} in plan ${plan}` };
	const target = found.subtask ?? found.step;
	if (target.status !== "owner") return { ok: false, status: 409, error: "this item is no longer waiting on you" };
	const q = target.question;
	if (!q) return { ok: false, status: 409, error: "this item has no question" };
	if (s(b["qhash"]) !== q.hash) return { ok: false, status: 409, error: "stale: the question changed since the page loaded; reload and answer again" };
	const choice = b["choice"] == null || b["choice"] === "" ? null : s(b["choice"]);
	const otherRaw = b["other"] == null ? "" : s(b["other"]);
	if (otherRaw.length > MAX_OTHER) return { ok: false, status: 400, error: `other is over ${MAX_OTHER} characters` };
	const other = otherRaw || null;
	if (choice && other) return { ok: false, status: 400, error: "give a choice or other, not both" };
	if (choice && !q.options.some((o) => o.label === choice)) return { ok: false, status: 400, error: "choice is not one of the options" };
	if (!choice && !other) return { ok: false, status: 400, error: "pick an option or write an answer under Other" };
	const title = found.subtask ? found.subtask.title : found.step.name;
	return {
		ok: true,
		row: { plan, item, subtask, title, question: q.text, choice, other, qhash: q.hash, line: answerLine(item, subtask, title, choice, other) },
	};
}

/** The append-only log: one write at a time, identical answers within 60 s deduplicated. */
export class AnswerLog {
	private queue: Promise<unknown> = Promise.resolve();
	private recent: Array<{ key: string; id: string; t: number }> = [];
	constructor(private file: () => string) {}
	append(row: Omit<AnswerRow, "id" | "at">, now = Date.now()): Promise<{ id: string; duplicate: boolean }> {
		const key = JSON.stringify([row.plan, row.item, row.subtask, row.qhash, row.choice, row.other]);
		const run = async () => {
			this.recent = this.recent.filter((r) => now - r.t < DEDUPE_MS);
			const dup = this.recent.find((r) => r.key === key);
			if (dup) return { id: dup.id, duplicate: true };
			const at = new Date(now);
			const id = `a_${at.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}_${Math.random().toString(16).slice(2, 6)}`;
			const full: AnswerRow = { id, at: at.toISOString().replace(/\.\d+Z$/, "Z"), ...row };
			await appendFile(this.file(), `${JSON.stringify(full)}\n`, { flag: "a" });
			this.recent.push({ key, id, t: now });
			return { id, duplicate: false };
		};
		const p = this.queue.then(run, run);
		this.queue = p.catch(() => {});
		return p;
	}
}

/** What the page needs: per question hash, the latest answer, whether the hook delivered it and
 *  whether an agent reopened it. */
export function answerState(answers: AnswerRow[], delivered: DeliveredRow[], reopened: ReopenedRow[] = []) {
	const done = new Map(delivered.map((d) => [d.id, d.delivered_at]));
	const undone = new Set(reopened.map((r) => r.id));
	const byHash: Record<string, { id: string; at: string; line: string; delivered_at: string | null; reopened: boolean }> = {};
	for (const a of answers) byHash[a.qhash] = { id: a.id, at: a.at, line: a.line, delivered_at: done.get(a.id) ?? null, reopened: undone.has(a.id) };
	return { by_qhash: byHash, unread: answers.filter((a) => !done.has(a.id)).length };
}

/** Plans with each needs-you item joined to the page's answers (a new array; `plans` is not changed).
 *  Per item: the latest answer to its current question hash makes it answered, unless an agent
 *  reopened that answer; an answer only to an older question makes it "asked again". */
export function joinAnswers(plans: Plan[], answers: AnswerRow[], delivered: DeliveredRow[], reopened: ReopenedRow[] = []): Plan[] {
	if (!answers.length) return plans;
	const done = new Map(delivered.map((d) => [d.id, d.delivered_at]));
	const undone = new Map(reopened.map((r) => [r.id, r]));
	const latestByHash = new Map<string, AnswerRow>();
	const latestByItem = new Map<string, AnswerRow>();
	const key = (plan: string, item: string, sub: string | null) => JSON.stringify([plan, item, sub ?? null]);
	for (const a of answers) {
		if (!a?.id || !a.qhash) continue;
		latestByHash.set(`${key(a.plan, a.item, a.subtask)}#${a.qhash}`, a);
		latestByItem.set(key(a.plan, a.item, a.subtask), a);
	}
	const join = <T extends Step | Subtask>(x: T, k: string): T => {
		if (x.status !== "owner" || !x.question) return x;
		const cur = latestByHash.get(`${k}#${x.question.hash}`);
		const r = cur ? undone.get(cur.id) : undefined;
		if (cur && !r) {
			const answer: ItemAnswer = { id: cur.id, at: cur.at, line: cur.line, choice: cur.choice ?? null, other: cur.other ?? null, delivered_at: done.get(cur.id) ?? null };
			return { ...x, answer, reopened: null };
		}
		const prev = cur ?? latestByItem.get(k);
		if (!prev) return x;
		const reopenedAs: ItemReopened = r
			? { why: "reopened", at: r.at ?? null, note: typeof r.note === "string" && r.note ? r.note.slice(0, MAX_NOTE) : null, previous: { line: prev.line, at: prev.at } }
			: { why: "asked_again", at: null, note: null, previous: { line: prev.line, at: prev.at } };
		return { ...x, answer: null, reopened: reopenedAs };
	};
	const subs = (plan: string, step: string, list: Subtask[]): Subtask[] =>
		list.map((s) => join({ ...s, children: subs(plan, step, s.children) }, key(plan, step, s.id)));
	return plans.map((p) => ({ ...p, steps: p.steps.map((st) => join({ ...st, subtasks: subs(p.id, st.id, st.subtasks) }, key(p.id, st.id, null))) }));
}
