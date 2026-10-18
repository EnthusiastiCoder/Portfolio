// Machine-wide info-server port registry: one port per workspace, so the info servers of
// different projects never collide. The registry is a JSON file mapping an absolute workspace
// path to its port. The server never falls back to a hardcoded port: it looks its workspace up
// here and refuses to start if the workspace is not registered.
//
//   bun tools/info-server/port.ts register [workspace] [--port N]   next free port from 8792 up
//   bun tools/info-server/port.ts lookup   [workspace]              prints the port (exit 1 if none)
//   bun tools/info-server/port.ts list                              every workspace and its port
//
// workspace defaults to the project this file is installed in (tools/info-server → ../..).
// Env: INFO_PORT_REGISTRY (registry file), INFO_WORKSPACE (workspace for the server and lookup).

import { createConnection, createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

export const DEFAULT_REGISTRY = "C:\\Users\\enthu\\Projects\\Setup Prompts\\info-server\\ports.json";
export const BASE_PORT = 8792; // 8791 is Weave-Tauri's (outside Projects); every other project starts here.
const MAX_PORT = 8899;

export interface Registry {
	version: 1;
	workspaces: Record<string, number>;
}

export const registryFile = () => resolve(process.env["INFO_PORT_REGISTRY"] ?? DEFAULT_REGISTRY);

/** The project this copy is installed in: <project>/tools/info-server → <project>. */
export const defaultWorkspace = () => normalize(process.env["INFO_WORKSPACE"] ?? resolve(import.meta.dir, "..", ".."));

/** Absolute, no trailing separator. Keys keep their casing; comparison ignores case on Windows. */
export function normalize(p: string): string {
	let r = resolve(p);
	while (r.length > 3 && r.endsWith(sep)) r = r.slice(0, -1);
	return r;
}
const same = (a: string, b: string) =>
	process.platform === "win32" ? normalize(a).toLowerCase() === normalize(b).toLowerCase() : normalize(a) === normalize(b);

export function read(file = registryFile()): Registry {
	if (!existsSync(file)) return { version: 1, workspaces: {} };
	const r = JSON.parse(readFileSync(file, "utf8")) as Registry;
	return { version: 1, workspaces: r.workspaces ?? {} };
}

function write(reg: Registry, file = registryFile()): void {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(reg, null, "\t")}\n`);
	renameSync(tmp, file);
}

export function lookup(workspace = defaultWorkspace(), file = registryFile()): number | null {
	const hit = Object.entries(read(file).workspaces).find(([k]) => same(k, workspace));
	return hit ? hit[1] : null;
}

/** True when something already listens on the port (a connect succeeds or a bind fails). */
export async function inUse(port: number): Promise<boolean> {
	const connects = await new Promise<boolean>((done) => {
		const s = createConnection({ host: "127.0.0.1", port });
		const end = (v: boolean) => {
			s.destroy();
			done(v);
		};
		s.setTimeout(400, () => end(false));
		s.once("connect", () => end(true));
		s.once("error", () => end(false));
	});
	if (connects) return true;
	return new Promise<boolean>((done) => {
		const srv = createServer();
		srv.once("error", () => done(true));
		srv.listen(port, "127.0.0.1", () => srv.close(() => done(false)));
	});
}

/** Registers a workspace. Throws on a duplicate workspace, a taken port, or a listening port. */
export async function register(workspace: string, wanted?: number, file = registryFile()): Promise<number> {
	const ws = normalize(workspace);
	const reg = read(file);
	const existing = Object.entries(reg.workspaces).find(([k]) => same(k, ws));
	if (existing) throw new Error(`already registered: ${existing[0]} -> ${existing[1]}`);
	const taken = new Set(Object.values(reg.workspaces));
	let port: number | undefined;
	if (wanted !== undefined) {
		if (!Number.isInteger(wanted) || wanted < 1024 || wanted > 65535) throw new Error(`bad port: ${wanted}`);
		const owner = Object.entries(reg.workspaces).find(([, p]) => p === wanted);
		if (owner) throw new Error(`port ${wanted} is already registered to ${owner[0]}`);
		if (await inUse(wanted)) throw new Error(`port ${wanted} is already listening on this machine`);
		port = wanted;
	} else {
		for (let p = BASE_PORT; p <= MAX_PORT && port === undefined; p++) if (!taken.has(p) && !(await inUse(p))) port = p;
		if (port === undefined) throw new Error(`no free port in ${BASE_PORT}-${MAX_PORT}`);
	}
	reg.workspaces[ws] = port;
	write(reg, file);
	return port;
}
