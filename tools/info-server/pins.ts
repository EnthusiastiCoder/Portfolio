// Pinned links: the icon buttons in the navbar (now.json `pinned`). Four kinds:
//   "artifact-id" | { "id": "artifact-id", "label"?, "icon"? }            a registered page
//   { "key": "site",   "kind": "port", "port": 3000, "path"?: "/", "label", "icon" }   a local dev server,
//                                                                        probed by a TCP connect
//   { "key": "resume", "kind": "file", "dir": "public", "glob": "resume*.pdf", "label", "icon" }
//                      the newest matching file (dir relative to the workspace), served read-only at
//                      /files/pinned/<key>
//   { "key": "github", "kind": "url", "url": "https://…", "label", "icon" }   an external https page
// `icon` is a lucide icon name from kit/icons.js (drawn in a filled square) or up to 3 characters.
// A pin that cannot be reached right now stays visible, dimmed, with the reason.
import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

export interface PinSpec {
	key: string;
	kind: "artifact" | "port" | "file" | "url";
	label: string | null;
	icon: string | null;
	id?: string;
	port?: number;
	path?: string;
	dir?: string;
	glob?: string;
	url?: string;
}
export interface PinState {
	key: string;
	kind: PinSpec["kind"];
	label: string;
	icon: string | null;
	href: string | null;
	ok: boolean;
	reason: string | null;
	/** Opens in a new tab (url, file, port); artifact pins open in place. */
	external: boolean;
}
const KEY = /^[a-z0-9][a-z0-9-]{0,47}$/;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** now.json `pinned` → specs (bad entries dropped here, reported by pinProblems). */
export function pinSpecs(raw: unknown): PinSpec[] {
	const out: PinSpec[] = [];
	for (const p of Array.isArray(raw) ? raw : []) {
		if (typeof p === "string") {
			out.push({ key: p, kind: "artifact", id: p, label: null, icon: null });
			continue;
		}
		const r = p as Record<string, unknown> | null;
		if (!r || typeof r !== "object") continue;
		const kind = (str(r["kind"]) ?? (r["id"] ? "artifact" : "")) as PinSpec["kind"];
		const base = { label: str(r["label"]), icon: str(r["icon"]) };
		if (kind === "artifact" && str(r["id"])) out.push({ key: String(r["id"]), kind, id: String(r["id"]), ...base });
		else if (kind === "port" && KEY.test(String(r["key"])) && Number.isInteger(r["port"])) out.push({ key: String(r["key"]), kind, port: r["port"] as number, path: str(r["path"]) ?? "/", ...base });
		else if (kind === "file" && KEY.test(String(r["key"])) && str(r["dir"]) && str(r["glob"])) out.push({ key: String(r["key"]), kind, dir: String(r["dir"]), glob: String(r["glob"]), ...base });
		else if (kind === "url" && KEY.test(String(r["key"])) && /^https:\/\/[^\s"'<>]+$/.test(String(r["url"]))) out.push({ key: String(r["key"]), kind, url: String(r["url"]), ...base });
	}
	return out;
}

/** `*` and `?` only; matched against a file name, case-insensitively. */
export const globRe = (g: string) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");

/** The newest file in `dir` matching `glob`, or null. */
export async function newestFile(workspace: string, dir: string, glob: string): Promise<string | null> {
	const d = isAbsolute(dir) ? dir : resolve(workspace, dir);
	const re = globRe(glob);
	const names = (await readdir(d)).filter((n) => re.test(n));
	let best: { f: string; t: number } | null = null;
	for (const n of names) {
		const s = await stat(join(d, n)).catch(() => null);
		if (s?.isFile() && (!best || s.mtimeMs > best.t)) best = { f: join(d, n), t: s.mtimeMs };
	}
	return best?.f ?? null;
}

/** Is something listening on 127.0.0.1:port? A plain TCP connect with a short timeout. */
export async function probe(port: number, ms = 600): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			Bun.connect({ hostname: "127.0.0.1", port, socket: { data() {}, open(s) { s.end(); } } }).then(() => true, () => false),
			new Promise<boolean>((r) => {
				timer = setTimeout(() => r(false), ms);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

/** Problems in now.json `pinned`, for check.ts. `icons` = the lucide names kit/icons.js has. */
export function pinProblems(raw: unknown, artifactIds: Set<string>, icons: Set<string>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const p of Array.isArray(raw) ? raw : []) {
		const specs = pinSpecs([p]);
		if (!specs.length) {
			out.push(`now.json pinned: not a valid pin: ${JSON.stringify(p)}`);
			continue;
		}
		const s = specs[0]!;
		if (seen.has(s.key)) out.push(`now.json pinned ${s.key}: listed twice`);
		seen.add(s.key);
		if (s.kind === "artifact" && !artifactIds.has(s.id!)) out.push(`now.json pinned ${s.key}: not in artifacts.json`);
		if (s.icon && !icons.has(s.icon) && [...s.icon].length > 3) out.push(`now.json pinned ${s.key}: icon "${s.icon}" is neither a kit/icons.js name nor at most 3 characters`);
		if (s.kind !== "artifact" && !s.label) out.push(`now.json pinned ${s.key}: a ${s.kind} pin needs a label`);
	}
	return out;
}
