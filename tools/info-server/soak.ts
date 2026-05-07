// Soak test: proves the info server never hangs under the home page's real polling, for N minutes.
// Run (in the background; read the CSV afterwards, do not babysit it):
//   bun tools/info-server/soak.ts [--minutes 2] [--timeout-ms 2000] [--csv file.csv] [--stress N] [--port N]
//
// Replays the real poll rates of an open home page plus a monitor:
//   /api/health 1 s (the probe) · /api/mtime 5 s (an open kit page) · /api/now, /api/artifacts,
//   /api/plan 30 s (home) · / and /api/glossary 60 s (a page load).
// --stress N adds N clients that hit every endpoint back to back (no pause), to load the server.
// Every replayed request goes to the CSV (time, endpoint, status, ms, timeout); stress requests only
// count in the stats. One line per minute is printed: requests, health p50 / p95 / max, timeouts,
// errors, the server's own loop lag and snapshot age.
// Exit 1 when health p95 > 200 ms, or any request timed out or failed.
import { appendFileSync, writeFileSync } from "node:fs";
import { port as registryPort } from "./server";

const opt = (name: string, def: string) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : def;
};
const MINUTES = Number(opt("minutes", "2"));
const TIMEOUT = Number(opt("timeout-ms", "2000"));
const STRESS = Number(opt("stress", "0"));
const CSV = opt("csv", "");
const PORT = Number(opt("port", "0")) || registryPort();
const P95_LIMIT = 200;
// 127.0.0.1, not localhost: a localhost lookup that tries IPv6 first adds its own delay on Windows.
const BASE = `http://127.0.0.1:${PORT}`;

interface Row {
	t: number;
	path: string;
	status: number;
	ms: number;
	timeout: boolean;
}
const rows: Row[] = [];
let minuteRows: Row[] = [];
let lastHealth: { loop_lag_ms?: number; snapshot?: { age_ms?: number | null; took_ms?: number; pending_reads?: number }; stale?: boolean } = {};
let worstLag = 0;
let worstAge = 0;
if (CSV) writeFileSync(CSV, "time,elapsed_s,path,status,ms,timeout,loop_lag_ms,snapshot_age_ms\n");
const T0 = Date.now();

async function hit(path: string, log = true): Promise<void> {
	const start = performance.now();
	let status = 0;
	let timeout = false;
	try {
		const r = await fetch(BASE + path, { signal: AbortSignal.timeout(TIMEOUT) });
		status = r.status;
		const body = await r.text();
		if (path === "/api/health" && r.ok) {
			lastHealth = JSON.parse(body);
			worstLag = Math.max(worstLag, lastHealth.loop_lag_ms ?? 0);
			worstAge = Math.max(worstAge, lastHealth.snapshot?.age_ms ?? 0);
		}
	} catch (e) {
		timeout = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
	}
	const ms = performance.now() - start;
	const row = { t: Date.now(), path, status, ms, timeout };
	rows.push(row);
	minuteRows.push(row);
	if (CSV && log)
		appendFileSync(
			CSV,
			`${new Date(row.t).toISOString()},${((row.t - T0) / 1000).toFixed(1)},${path},${status},${ms.toFixed(1)},${timeout ? 1 : 0},${lastHealth.loop_lag_ms ?? ""},${lastHealth.snapshot?.age_ms ?? ""}\n`,
		);
}

const pct = (xs: number[], p: number) => {
	if (!xs.length) return Number.NaN;
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
};
const f = (n: number) => (Number.isNaN(n) ? "—" : n < 10 ? n.toFixed(1) : String(Math.round(n)));

// Preflight: the server must answer, and an artifact id for /api/mtime.
let mtimeId = "x";
try {
	const a = (await (await fetch(`${BASE}/api/artifacts`, { signal: AbortSignal.timeout(TIMEOUT) })).json()) as { artifacts: Array<{ id: string }> };
	mtimeId = a.artifacts[0]?.id ?? "x";
} catch (e) {
	console.error(`✗ info server not reachable at ${BASE}: ${(e as Error).message}`);
	process.exit(1);
}

console.log(`soak ${BASE} · ${MINUTES} min · timeout ${TIMEOUT} ms · ${STRESS} stress client(s)${CSV ? ` · csv ${CSV}` : ""}`);
console.log("min   reqs  health p50   p95   max ms  timeouts errors  loop lag  snapshot age");

const timers: Array<ReturnType<typeof setInterval>> = [];
const every = (ms: number, paths: string[]) => {
	const go = () => {
		for (const p of paths) void hit(p);
	};
	go();
	timers.push(setInterval(go, ms));
};
every(1000, ["/api/health"]);
every(5000, [`/api/mtime?id=${encodeURIComponent(mtimeId)}`]);
every(30000, ["/api/now", "/api/artifacts", "/api/plan"]);
every(60000, ["/", "/api/glossary"]);
let running = true;
const ALL = ["/api/now", "/api/artifacts", "/api/plan", "/api/glossary", `/api/mtime?id=${mtimeId}`, "/"];
for (let i = 0; i < STRESS; i++)
	void (async () => {
		for (let k = i; running; k++) await hit(ALL[k % ALL.length]!, false);
	})();

const minutes: string[] = [];
let minute = 0;
const endAt = T0 + MINUTES * 60000;
while (Date.now() < endAt) {
	await Bun.sleep(Math.min(60000, endAt - Date.now()));
	minute++;
	const rs = minuteRows;
	minuteRows = [];
	const h = rs.filter((r) => r.path === "/api/health" && !r.timeout && r.status).map((r) => r.ms);
	const line = `${String(minute).padStart(3)}  ${String(rs.length).padStart(5)}  ${f(pct(h, 50)).padStart(10)}  ${f(pct(h, 95)).padStart(5)}  ${f(Math.max(0, ...h)).padStart(6)}  ${String(rs.filter((r) => r.timeout).length).padStart(8)} ${String(rs.filter((r) => !r.timeout && r.status !== 200).length).padStart(6)}  ${String(worstLag).padStart(5)} ms  ${String(worstAge).padStart(7)} ms`;
	minutes.push(line);
	console.log(line);
	worstLag = 0;
	worstAge = 0;
}
running = false;
for (const t of timers) clearInterval(t);
await Bun.sleep(Math.min(TIMEOUT, 2000) + 100); // let the last requests settle

const health = rows.filter((r) => r.path === "/api/health");
const hms = health.filter((r) => !r.timeout && r.status).map((r) => r.ms);
const timeouts = rows.filter((r) => r.timeout).length;
const errors = rows.filter((r) => !r.timeout && r.status !== 200).length;
const p95 = pct(hms, 95);
const byPath = new Map<string, number[]>();
for (const r of rows) if (!r.timeout) (byPath.get(r.path.split("?")[0]!) ?? byPath.set(r.path.split("?")[0]!, []).get(r.path.split("?")[0]!)!).push(r.ms);
console.log("\nendpoint            n     p50    p95    max ms");
for (const [p, ms] of byPath) console.log(`${p.padEnd(16)} ${String(ms.length).padStart(5)}  ${f(pct(ms, 50)).padStart(6)} ${f(pct(ms, 95)).padStart(6)} ${f(Math.max(...ms)).padStart(6)}`);
const ok = p95 <= P95_LIMIT && timeouts === 0 && errors === 0 && hms.length > 0;
console.log(
	`\n${ok ? "✓ PASS" : "✗ FAIL"}: ${rows.length} requests in ${MINUTES} min · health p50 ${f(pct(hms, 50))} ms, p95 ${f(p95)} ms (limit ${P95_LIMIT}), max ${f(Math.max(0, ...hms))} ms · ${timeouts} timeouts · ${errors} errors`,
);
process.exit(ok ? 0 : 1);
