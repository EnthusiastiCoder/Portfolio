// Stops this workspace's info server and frees its port, on Windows too.
// Run: bun tools/info-server/stop.ts [--port N]          (exit 0 = stopped and the port is free)
//
// Kills the pidfile's process TREE (server.ts writes os.tmpdir()/info-server-<port>.pid) plus any
// other bun process LISTENING on the port (a second copy started by hand), then waits up to ~5 s
// and checks for itself: every process gone AND nothing listening. A kill's exit code proves
// nothing: a process stuck in kernel I/O (a file read held by an antivirus or sync filter) survives
// every kill until the I/O completes. Survivors are named as "stuck in kernel I/O" and the exit is 1.
// A listener that is not bun is never killed (it is not ours); it is named instead.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { pidFile, port as registryPort } from "./server";

const WIN = process.platform === "win32";
const arg = process.argv.indexOf("--port");
const port = arg > 0 ? Number(process.argv[arg + 1]) : registryPort();
if (!Number.isInteger(port) || port <= 0) {
	console.error("usage: bun tools/info-server/stop.ts [--port N]");
	process.exit(2);
}

const run = (cmd: string[]) => {
	const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
	return r.stdout.toString();
};
/** PIDs listening on the port. Queued connections show as extra LISTENING rows with PID 0: ignored. */
function listeners(): number[] {
	if (WIN) {
		const out = run(["netstat", "-ano", "-p", "TCP"]) + run(["netstat", "-ano", "-p", "TCPv6"]);
		const pids = new Set<number>();
		for (const line of out.split(/\r?\n/)) {
			const f = line.trim().split(/\s+/);
			if (f[0] !== "TCP" || f[3] !== "LISTENING") continue;
			if (!new RegExp(`[:.]${port}$`).test(f[1] ?? "")) continue;
			const pid = Number(f[4]);
			if (pid > 0) pids.add(pid);
		}
		return [...pids];
	}
	return run(["lsof", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"]).split(/\s+/).filter(Boolean).map(Number).filter((p) => p > 0);
}
/** The image name of a live process, or null when it is gone. */
function nameOf(pid: number): string | null {
	if (WIN) {
		const out = run(["tasklist", "/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"]).trim();
		const m = /^"([^"]+)","(\d+)"/.exec(out);
		return m && Number(m[2]) === pid ? m[1]! : null;
	}
	const out = run(["ps", "-o", "comm=", "-p", String(pid)]).trim();
	return out || null;
}
const isBun = (name: string | null) => !!name && /^bun(\.exe)?$/i.test(name.split(/[\\/]/).pop()!);
function killTree(pid: number) {
	if (WIN) run(["taskkill", "/F", "/T", "/PID", String(pid)]);
	else {
		run(["pkill", "-KILL", "-P", String(pid)]);
		run(["kill", "-KILL", String(pid)]);
	}
}

const file = pidFile(port);
const fromFile = existsSync(file) ? Number(readFileSync(file, "utf8").trim()) : 0;
const targets = new Map<number, string>();
const foreign: string[] = [];
if (fromFile > 0 && fromFile !== process.pid) {
	const n = nameOf(fromFile);
	// A stale pidfile may name a pid the OS has since given to something else: only a bun is ours.
	if (isBun(n)) targets.set(fromFile, `${n} (pidfile)`);
}
for (const pid of listeners()) {
	const n = nameOf(pid);
	if (pid === process.pid) continue;
	if (isBun(n)) targets.set(pid, `${n} (listening on ${port})`);
	else foreign.push(`${n ?? "?"} pid ${pid}`);
}
if (!targets.size && !foreign.length) {
	rmSync(file, { force: true });
	console.log(`nothing to stop: no info server on port ${port}`);
	process.exit(0);
}
for (const pid of targets.keys()) killTree(pid);

// Verify by looking, never by the kill's exit code.
const deadline = Date.now() + 5000;
let alive: number[] = [];
let held: number[] = [];
do {
	await Bun.sleep(250);
	alive = [...targets.keys()].filter((pid) => nameOf(pid) !== null);
	held = listeners().filter((pid) => targets.has(pid));
} while ((alive.length || held.length) && Date.now() < deadline);

const report = [...targets].map(([pid, what]) => `${alive.includes(pid) ? "✗ survived" : "✓ stopped"} pid ${pid} ${what}`);
console.log(report.join("\n"));
if (foreign.length) console.error(`✗ port ${port} is held by a process that is not an info server (not killed): ${foreign.join(", ")}`);
if (alive.length) {
	console.error(`✗ stuck in kernel I/O: ${alive.map((p) => `${targets.get(p)} pid ${p}`).join(", ")}: Windows cannot end a process until its pending file I/O completes. Try again later; it usually exits on its own.`);
}
const free = listeners().length === 0;
if (!alive.length) rmSync(file, { force: true });
console.log(free ? `✓ port ${port} is free` : `✗ port ${port} is still taken`);
process.exit(alive.length || !free ? 1 : 0);
