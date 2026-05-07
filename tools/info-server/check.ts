// Validates the info server's content. Run: bun info-server/check.ts  (exit 1 on any problem)
//   glossary   every [[ref]] resolves, no self-reference, ≤ 200 chars and ≤ 2 sentences per definition
//   manifest   ids valid and unique, files exist, projects known
//   now.json   status states known; pinned ids registered, unique, their files present
//   plan.json  (optional) steps valid: ids unique, statuses known, depends_on resolve, links same-app
//   kit pages  every data-kit-open has its modal, every modal starts with a visual,
//              no text block > 240 chars, bird's-eye answer ≤ 5 lines, every gallery image exists
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { planProblems, questionProblems } from "./plan";
import { type Artifact, CONTENT, content, fileOf } from "./server";

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
const pinned = new Set<string>();
for (const p of now?.pinned ?? []) {
	const id = typeof p === "string" ? p : (p as { id?: string } | null)?.id;
	if (!id) {
		problems.push(`now.json pinned: an entry without an id: ${JSON.stringify(p)}`);
		continue;
	}
	if (pinned.has(id)) problems.push(`now.json pinned ${id}: listed twice`);
	pinned.add(id);
	const a = m.artifacts.find((x) => x.id === id);
	if (!a) problems.push(`now.json pinned ${id}: not in artifacts.json`);
	else if (!existsSync(fileOf(a))) problems.push(`now.json pinned ${id}: its file is missing`);
	const icon = typeof p === "object" ? (p as { icon?: unknown }).icon : undefined;
	if (icon !== undefined && (typeof icon !== "string" || [...icon].length > 3)) problems.push(`now.json pinned ${id}: icon must be at most 3 characters`);
}

// plan.json (optional): the plan graph on the home page.
if (existsSync(join(CONTENT, "plan.json"))) {
	try {
		problems.push(...planProblems(content<unknown>("plan.json", null)));
	} catch (e) {
		problems.push(`plan.json: ${(e as Error).message}`);
	}
}

if (problems.length) {
	console.error(problems.map((p) => `✗ ${p}`).join("\n"));
	process.exit(1);
}
console.log(
	`ok: ${Object.keys(g.terms).length} terms, ${m.artifacts.length} artifacts, ${pinned.size} pins, ${existsSync(join(CONTENT, "plan.json")) ? "plan.json" : "plan from now.json"}`,
);
