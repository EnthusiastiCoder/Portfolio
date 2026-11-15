// Validates the info server's content. Run: bun info-server/check.ts  (exit 1 on any problem)
//   glossary   every [[ref]] resolves, no self-reference, ≤ 200 chars and ≤ 2 sentences per definition
//   manifest   ids valid and unique, files exist, projects known
//   kit pages  every data-kit-open has its modal, every modal starts with a visual,
//              no text block > 240 chars, bird's-eye answer ≤ 5 lines
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Artifact, CONTENT, fileOf } from "./server";

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
}
if (problems.length) {
	console.error(problems.map((p) => `✗ ${p}`).join("\n"));
	process.exit(1);
}
console.log(`ok: ${Object.keys(g.terms).length} terms, ${m.artifacts.length} artifacts`);
