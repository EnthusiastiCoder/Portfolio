// Project info server — shows answers and artifacts illustratively: bird's-eye first, details in
// stacked modals, hover definitions. Local only, read-only. Run: bun tools/info-server/server.ts
// The port comes from the machine-wide registry (port.ts): register the workspace once first.
//
// CODE is shared (this folder). CONTENT is each person's own and gitignored: content/ (or
// $INFO_CONTENT_DIR) holds now.json, artifacts.json, glossary.json, artifacts/, builders/.
//
//   /                     home: what we are working on now + latest deliverables; library in a modal
//   /a/<id>/              a kit page (content/artifacts/<id>.html)
//   /view/<id>            any artifact (legacy files framed with a Back bar)
//   /raw/<id>             a legacy file itself
//   /api/now | /api/artifacts | /api/glossary | /api/mtime?id=<id> | /api/health
//   /kit/*                kit.css, kit.js
//
// Rules: GET/HEAD only; Host must be localhost/127.0.0.1; no-store on /api.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { resolvePort } from "./port";

const ROOT = import.meta.dir;
export const CONTENT = resolve(process.env["INFO_CONTENT_DIR"] ?? join(ROOT, "content"));
/** This workspace's port from the machine-wide registry (port.ts); never a hardcoded default. */
let cachedPort: number | undefined;
export const port = () => (cachedPort ??= resolvePort());

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
};
const SECURITY = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

export interface Artifact {
	id: string;
	title: string;
	kind: "kit" | "legacy";
	/** legacy: absolute, or relative to the content folder. */
	path: string;
	project: string;
	topic: string;
	headline: string;
}

/** A content file, or `empty` when this person has not made it yet. */
function content<T>(file: string, empty: T): T {
	const f = join(CONTENT, file);
	return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : empty;
}
const manifest = () =>
	content<{ version: number; projects: Array<{ id: string }>; artifacts: Artifact[] }>("artifacts.json", {
		version: 1,
		projects: [],
		artifacts: [],
	});
export const fileOf = (a: Artifact) =>
	a.kind === "kit" ? join(CONTENT, "artifacts", `${a.id}.html`) : isAbsolute(a.path) ? a.path : resolve(CONTENT, a.path);

function send(file: string, extra: Record<string, string> = {}): Response {
	if (!existsSync(file)) return new Response("not found", { status: 404 });
	return new Response(Bun.file(file), {
		headers: { "Content-Type": MIME[extname(file)] ?? "application/octet-stream", ...SECURITY, ...extra },
	});
}
const json = (data: unknown) =>
	new Response(JSON.stringify(data), { headers: { "Content-Type": MIME[".json"]!, "Cache-Control": "no-store", ...SECURITY } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The legacy frame: a Back bar over the original file, in the kit theme. */
function frame(a: Artifact): Response {
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)}</title><link rel="stylesheet" href="/kit/kit.css"></head>
<body class="kit-frame"><header class="kit-bar"><a class="kit-back" href="/">← Home</a><b>${esc(a.title)}</b>
<span class="kit-chip">older format</span><a class="kit-standalone" href="/raw/${esc(a.id)}" target="_blank" rel="noopener">Open standalone</a></header>
<iframe src="/raw/${esc(a.id)}" title="${esc(a.title)}"></iframe></body></html>`;
	return new Response(html, { headers: { "Content-Type": MIME[".html"]!, ...SECURITY } });
}

export function handle(req: Request): Response {
	if (req.method !== "GET" && req.method !== "HEAD") return new Response("read-only", { status: 405 });
	const host = (req.headers.get("host") ?? "").split(":")[0];
	if (host !== "localhost" && host !== "127.0.0.1") return new Response("local only", { status: 403 });
	const url = new URL(req.url);
	const p = decodeURIComponent(url.pathname);
