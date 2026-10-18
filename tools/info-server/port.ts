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
