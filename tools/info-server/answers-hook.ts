// The answers hook: hands answers clicked on the info-server page to the session's next turn.
//
// Wired in .claude/settings.json for UserPromptSubmit and SessionStart:
//   bun "$CLAUDE_PROJECT_DIR/tools/info-server/answers-hook.ts"
// Reads the hook's stdin JSON ({ cwd, session_id, hook_event_name }), finds tools/info-server/content
// from cwd upward, and prints the undelivered answers (answers.jsonl minus answers.delivered.jsonl)
// as additionalContext. Each delivered id is then appended to answers.delivered.jsonl, so an answer
// reaches exactly one turn. An O_EXCL lock (answers.lock) stops two hooks delivering the same row.
// Each answer is labelled: "question hash ok", "STALE" when the question changed or the item no
// longer waits on the user, and "old" past 24 h. Any error prints nothing and exits 0: a hook must
// never block a prompt.
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ANSWERS, type AnswerRow, DELIVERED, type DeliveredRow, jsonl } from "./answers";
import { findItem, loadPlansSync } from "./plan";

const LOCK = "answers.lock";
const LOCK_STALE_MS = 10_000;
const OLD_MS = 24 * 3600 * 1000;

const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");

/** The content folder: cwd or the nearest parent that holds tools/info-server/content. */
function contentDir(cwd: string): string | null {
	let d = resolve(cwd);
	for (;;) {
		const c = join(d, "tools", "info-server", "content");
		if (existsSync(c)) return c;
		const up = dirname(d);
		if (up === d) return null;
		d = up;
	}
}

function lock(file: string): number | null {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			return openSync(file, "wx");
		} catch {
			try {
				if (Date.now() - statSync(file).mtimeMs > LOCK_STALE_MS) unlinkSync(file);
				else return null;
			} catch {
				return null;
			}
		}
	}
	return null;
}

const hhmm = (iso: string) => {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "?" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

async function main() {
	const input = (await Bun.stdin.text()) || "{}";
	const hook = JSON.parse(input) as { cwd?: string; session_id?: string; hook_event_name?: string };
	const content = contentDir(hook.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
	if (!content) return;
	const answersFile = join(content, ANSWERS);
	const deliveredFile = join(content, DELIVERED);
	const pending = () => {
		const done = new Set(jsonl<DeliveredRow>(read(deliveredFile)).map((d) => d.id));
		return jsonl<AnswerRow>(read(answersFile)).filter((a) => a.id && !done.has(a.id));
	};
	if (!pending().length) return;
	const lockFile = join(content, LOCK);
	const fd = lock(lockFile);
	if (fd === null) return; // another hook is delivering right now: it takes these rows
	try {
		const rows = pending(); // re-read inside the lock: never deliver a row twice
		if (!rows.length) return;
		const plans = loadPlansSync(content);
		const now = Date.now();
		const lines = rows.map((a) => {
			const f = findItem(plans, a.plan, a.item, a.subtask ?? null);
			const target = f ? (f.subtask ?? f.step) : null;
			const fresh = target && target.status === "owner" && target.question?.hash === a.qhash;
			const old = now - Date.parse(a.at) > OLD_MS;
			const mark = fresh ? "question hash ok" : "STALE: the question changed or no longer waits on the user, confirm before acting";
			return `- [${a.plan}] ${a.line} (answered ${hhmm(a.at)} local, ${a.at}${old ? ", old: over 24 h ago" : ""}, ${mark})`;
		});
		const text = `Answers from the info server (clicked by the user on the localhost page, not typed in chat; each answers only that one question):\n${lines.join("\n")}`;
		const at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
		appendFileSync(deliveredFile, rows.map((a) => `${JSON.stringify({ id: a.id, delivered_at: at, session: hook.session_id ?? null })}\n`).join(""));
		process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: hook.hook_event_name || "UserPromptSubmit", additionalContext: text } }));
	} finally {
		closeSync(fd);
		try {
			unlinkSync(lockFile);
		} catch {}
	}
}

try {
	await main();
} catch {}
process.exit(0);
