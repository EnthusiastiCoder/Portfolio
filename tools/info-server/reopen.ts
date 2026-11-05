// Reopens an answered needs-you item: the owner's answer from the page turned out not to hold.
//
//   bun tools/info-server/reopen.ts <plan> <item>[.<subtask>] "<short note, ≤ 200 chars>"
//   bun tools/info-server/reopen.ts showcase D "The pushes did not reach GitHub"
//
// Appends { id: <answer id>, at, note } to content/answers.reopened.jsonl (append-only, like the
// answers). The page then shows the item as "Needs you" again with the note, and the needs-you count
// includes it. A new answer from the page to the same question makes it answered again. Changing the
// item's question (a new hash) also reopens it, without this script. Exit 1 when there is nothing to
// reopen (no such item, it does not say "owner", or no answer to its current question).
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ANSWERS, type AnswerRow, jsonl, MAX_NOTE, REOPENED, type ReopenedRow } from "./answers";
import { findItem, loadPlansSync } from "./plan";
import { CONTENT } from "./server";

const [plan, ref, ...rest] = process.argv.slice(2);
const note = rest.join(" ").trim();
if (!plan || !ref || !note) {
	console.error('usage: bun tools/info-server/reopen.ts <plan> <item>[.<subtask>] "<short note>"');
	process.exit(2);
}
if (note.length > MAX_NOTE) {
	console.error(`the note is ${note.length} chars: keep it ≤ ${MAX_NOTE}`);
	process.exit(2);
}
const [item, subtask = null] = ref.split(".") as [string, string | undefined];
const found = findItem(loadPlansSync(CONTENT), plan, item, subtask ?? null);
const target = found ? (found.subtask ?? found.step) : null;
if (!target) {
	console.error(`no item ${ref} in plan ${plan}`);
	process.exit(1);
}
if (target.status !== "owner" || !target.question) {
	console.error(`${plan} ${ref} does not wait on the owner in its content (status ${target.status}): nothing to reopen`);
	process.exit(1);
}
const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const answers = jsonl<AnswerRow>(read(join(CONTENT, ANSWERS)));
const hash = target.question.hash;
const last = answers.filter((a) => a.plan === plan && a.item === item && (a.subtask ?? null) === (subtask ?? null) && a.qhash === hash).at(-1);
if (!last) {
	console.error(`${plan} ${ref} has no answer to its current question: it already shows as needs-you`);
	process.exit(1);
}
if (jsonl<ReopenedRow>(read(join(CONTENT, REOPENED))).some((r) => r.id === last.id)) {
	console.log(`already reopened: ${last.id} (${last.line})`);
	process.exit(0);
}
const row: ReopenedRow = { id: last.id, at: new Date().toISOString().replace(/\.\d+Z$/, "Z"), note };
appendFileSync(join(CONTENT, REOPENED), `${JSON.stringify(row)}\n`);
console.log(`reopened ${plan} ${ref}: answer ${last.id} (“${last.line}”) no longer holds · ${note}`);
