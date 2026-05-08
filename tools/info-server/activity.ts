// The Activity tile (All stages): what happened in this workspace in the last 24 h, from metadata only.
//   reports    plans/reports/<YYYY-MM-DDTHH-MM-SS>_<agent>/   (names the refresher already lists)
//   handoffs   plans/handoffs/<ts>_<agent>_<n>.md
//   commits    git log --all --since=24.hours (hash, time, subject)
//   agents     Claude Code subagent metadata (<session>/subagents/agent-*.meta.json: name, type,
//              description) and the transcript's mtime; a transcript's content is never read.
// Every string from outside the server passes redact().
import { redact } from "./safety";

export const WINDOW_MS = 24 * 3600 * 1000;
const RUNNING_IDLE_MS = 180_000;
const LIMIT = { reports: 20, handoffs: 10, commits: 30, agents: 40 };
const STAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})_(.+?)(?:_\d+)?(?:\.md)?$/;

export interface Activity {
	reports: Array<{ name: string; agent: string; at: string }>;
	handoffs: Array<{ name: string; agent: string; at: string }>;
	commits: Array<{ sha: string; at: string; subject: string }>;
	agents: Array<{ name: string; type: string | null; description: string | null; at: string; state: "running" | "quiet" }>;
}
export const emptyActivity = (): Activity => ({ reports: [], handoffs: [], commits: [], agents: [] });

/** A report or handoff name → its agent and UTC time (the stamp is UTC, as the orchestrator writes it). */
export function stamped(name: string): { agent: string; at: string } | null {
	const m = STAMP.exec(name);
	if (!m) return null;
	const t = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
	return Number.isNaN(t.getTime()) ? null : { agent: m[5]!, at: t.toISOString() };
}
export function writeupRows(names: string[], now: number, limit: number) {
	return names
		.map((name) => ({ name, ...stamped(name) }))
		.filter((r): r is { name: string; agent: string; at: string } => !!r.at && now - Date.parse(r.at) <= WINDOW_MS)
		.slice(0, limit);
}
/** `git log --pretty=%h%x09%cI%x09%s` output → rows. */
export function parseGit(out: string): Activity["commits"] {
	return out
		.split(/\r?\n/)
		.filter(Boolean)
		.map((l) => l.split("\t"))
		.filter((p) => p.length >= 3)
		.map(([sha, at, ...s]) => ({ sha: sha!, at: new Date(at!).toISOString(), subject: redact(s.join("\t")) ?? "" }))
		.slice(0, LIMIT.commits);
}
export function agentRow(meta: unknown, mtime: number, now: number): Activity["agents"][number] | null {
	const m = meta as Record<string, unknown> | null;
	if (!m || typeof m !== "object") return null;
	const str = (v: unknown) => (typeof v === "string" && v ? redact(v.slice(0, 160)) : null);
	return {
		name: str(m["name"]) ?? "unnamed agent",
		type: str(m["agentType"]),
		description: str(m["description"]),
		at: new Date(mtime).toISOString(),
		state: now - mtime <= RUNNING_IDLE_MS ? "running" : "quiet",
	};
}
export const ACTIVITY_LIMIT = LIMIT;
