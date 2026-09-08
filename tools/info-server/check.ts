// Validates the info server's content. Run: bun info-server/check.ts  (exit 1 on any problem)
//   glossary   every [[ref]] resolves, no self-reference, ≤ 200 chars and ≤ 2 sentences per definition
//   manifest   ids valid and unique, files exist, projects known
//   now.json   status states known; pins valid (artifact | port | file | url), icons known; plans ids exist
//   plans/*.json, plan.json  steps valid: ids unique, statuses known, depends_on resolve, links same-app;
//              every needs-you step or subtask has a question (fails otherwise)
//   usage.json (optional) groups and sources well formed
//   answers    warns when an answer sent over 1 h ago is still undelivered
//   kit pages  every data-kit-open has its modal, every modal starts with a visual,
//              no text block > 240 chars, bird's-eye answer ≤ 5 lines, every gallery image exists
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ANSWERS, type AnswerRow, DELIVERED, type DeliveredRow, jsonl } from "./answers";
import { pinProblems, pinSpecs } from "./pins";
import { PLAN_FILE, planProblems, questionProblems } from "./plan";
import { type Artifact, CONTENT, content, fileOf } from "./server";
import { usageProblems } from "./usage";

const problems: string[] = [];
const g = JSON.parse(readFileSync(join(CONTENT, "glossary.json"), "utf8")) as {
	terms: Record<string, { label: string; definition: string; aliases?: string[] }>;
};
for (const [key, t] of Object.entries(g.terms)) {
	if (t.definition.length > 200) problems.push(`glossary ${key}: definition ${t.definition.length} > 200 chars`);
	if ((t.definition.match(/[.!?](\s|$)/g) ?? []).length > 2) problems.push(`glossary ${key}: more than 2 sentences`);
	for (const [, ref] of t.definition.matchAll(/\[\[([a-z0-9_-]+)(?:\|[^\]]+)?\]\]/g)) {
		if (!g.terms[ref!]) problems.push(`glossary ${key}: [[${ref}]] is not defined`);
		if (ref === key) problems.push(`glossary ${key}: refers to itself`);
	}
}
const m = JSON.parse(readFileSync(join(CONTENT, "artifacts.json"), "utf8")) as {
	projects: Array<{ id: string }>;
	artifacts: Artifact[];
};
const ids = new Set<string>();
for (const a of m.artifacts) {
	if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(a.id)) problems.push(`manifest ${a.id}: bad id`);
	if (ids.has(a.id)) problems.push(`manifest ${a.id}: duplicate`);
	ids.add(a.id);
	if (!m.projects.some((p) => p.id === a.project)) problems.push(`manifest ${a.id}: unknown project ${a.project}`);
	const file = fileOf(a);
	if (!existsSync(file)) problems.push(`manifest ${a.id}: missing file ${file}`);
	if (a.kind !== "kit" || !existsSync(file)) continue;
	const html = readFileSync(file, "utf8");
	const modals = new Set([...html.matchAll(/id="m-([a-z0-9-]+)"/g)].map((x) => x[1]));
	for (const [, open] of html.matchAll(/data-kit-open="([a-z0-9-]+)"/g)) {
		if (!modals.has(open)) problems.push(`${a.id}: data-kit-open="${open}" has no modal`);
	}
	for (const [, body] of html.matchAll(/<section class="kit-modal-src"[^>]*>\s*([\s\S]{0,40})/g)) {
		if (!body!.startsWith('<div class="kit-visual"')) problems.push(`${a.id}: a modal does not start with a visual`);
	}
	for (const [, text] of html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)) {
		const plain = text!.replace(/<[^>]+>/g, "");
		if (plain.length > 240) problems.push(`${a.id}: paragraph over 240 chars: "${plain.slice(0, 60)}…"`);
	}
	const answer = /<div class="kit-answer">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
	if ((answer.match(/<p>/g) ?? []).length > 5) problems.push(`${a.id}: bird's-eye answer over 5 lines`);
	// Gallery images (blocks.gallery): each thumbnail's image must exist next to the page.
	for (const [, src] of html.matchAll(/<button class="kit-shot"[^>]*><img src="([^"]+)"/g)) {
		if (/^[a-z]+:|^\/\//i.test(src!)) problems.push(`${a.id}: gallery image must be local: ${src}`);
		else if (!src!.startsWith("/") && !existsSync(resolve(dirname(file), src!))) problems.push(`${a.id}: gallery image missing: ${src}`);
	}
}

// now.json: the home page's status list and pinned links.
const STATES = ["done", "doing", "waiting", "blocked", "todo"];
const now = content<{ status?: Array<{ label?: string; state?: string }>; pinned?: unknown[] } | null>("now.json", null);
for (const [i, s] of (now?.status ?? []).entries()) {
	if (!s?.label) problems.push(`now.json status ${i + 1}: no label`);
	if (!STATES.includes(s?.state ?? "")) problems.push(`now.json status ${s?.label ?? i + 1}: unknown state "${s?.state}" (${STATES.join("|")})`);
	// Anything waiting on the owner must say what it asks: a needs-you item without a question is a dead end.
	if (s?.state === "waiting") problems.push(...questionProblems(s as Record<string, unknown>, `now.json status "${s.label ?? i + 1}"`));
}
const pinList = now?.pinned ?? [];
const iconNames = new Set([...readFileSync(join(import.meta.dir, "kit", "icons.js"), "utf8").matchAll(/^\t"([a-z0-9-]+)":/gm)].map((x) => x[1]!));
problems.push(...pinProblems(pinList, ids, iconNames));
for (const s of pinSpecs(pinList)) {
	if (s.kind !== "artifact") continue;
	const a = m.artifacts.find((x) => x.id === s.id);
	if (a && !existsSync(fileOf(a))) problems.push(`now.json pinned ${s.key}: its file is missing`);
}

// Plans: content/plans/<id>.json (several, home switches between them), else plan.json (optional).
// Every needs-you item (step or subtask) must carry its question: questionProblems fails it otherwise.
const plansDir = join(CONTENT, "plans");
const planFiles = existsSync(plansDir) ? readdirSync(plansDir).filter((n) => n.endsWith(".json")) : [];
for (const f of planFiles) {
	if (!PLAN_FILE.test(f)) {
		problems.push(`plans/${f}: the file name must be <id>.json with a lower-case id (a-z, 0-9, -)`);
		continue;
	}
	try {
		problems.push(...planProblems(content<unknown>(`plans/${f}`, null), `plans/${f}`));
	} catch (e) {
		problems.push(`plans/${f}: ${(e as Error).message}`);
	}
}
const order = (now as { plans?: unknown } | null)?.plans;
if (order !== undefined) {
	if (!Array.isArray(order)) problems.push("now.json plans: must be a list of plan ids");
	else for (const id of order) if (!planFiles.includes(`${id}.json`)) problems.push(`now.json plans: "${id}" has no content/plans/${id}.json`);
}
if (existsSync(join(CONTENT, "plan.json"))) {
	try {
		problems.push(...planProblems(content<unknown>("plan.json", null)));
	} catch (e) {
		problems.push(`plan.json: ${(e as Error).message}`);
	}
}

// usage.json (optional): where the usage strip reads Claude, Fireworks and GLM.
if (existsSync(join(CONTENT, "usage.json"))) {
	try {
		problems.push(...usageProblems(JSON.parse(readFileSync(join(CONTENT, "usage.json"), "utf8"))));
	} catch (e) {
		problems.push(`usage.json: ${(e as Error).message}`);
	}
}

// answers.jsonl: a warning (not a failure) when a sent answer has waited over an hour for a turn.
const warnings: string[] = [];
const delivered = new Set(jsonl<DeliveredRow>(existsSync(join(CONTENT, DELIVERED)) ? readFileSync(join(CONTENT, DELIVERED), "utf8") : "").map((d) => d.id));
const unread = jsonl<AnswerRow>(existsSync(join(CONTENT, ANSWERS)) ? readFileSync(join(CONTENT, ANSWERS), "utf8") : "").filter((a) => !delivered.has(a.id));
const late = unread.filter((a) => Date.now() - Date.parse(a.at) > 3600_000);
if (late.length) warnings.push(`answers.jsonl: ${late.length} answer(s) sent over 1 h ago are still undelivered (is the answers hook in .claude/settings.json?)`);

if (warnings.length) console.warn(warnings.map((w) => `! ${w}`).join("\n"));
if (problems.length) {
	console.error(problems.map((p) => `✗ ${p}`).join("\n"));
	process.exit(1);
}
console.log(
	`ok: ${Object.keys(g.terms).length} terms, ${m.artifacts.length} artifacts, ${pinSpecs(pinList).length} pins, ${planFiles.length ? `${planFiles.length} plans (content/plans)` : existsSync(join(CONTENT, "plan.json")) ? "plan.json" : "plan from now.json"}, ${unread.length} unread answer(s)`,
);
