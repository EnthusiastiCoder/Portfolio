// Screenshot CLI for agents: one long-lived headless Chromium, reused by every shot.
//   bun tools/shot/shot.ts <url> [--w 390] [--h 844] [--full] [--out path]
//   bun tools/shot/shot.ts --stop
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium, type Browser } from "@playwright/test";

const STATE = join(tmpdir(), "agent-shot-browser.json");
type State = { ws: string; pid: number; browserPid?: number };

function readState(): State | null {
  try {
    return JSON.parse(readFileSync(STATE, "utf8")) as State;
  } catch {
    return null;
  }
}

/** Child mode: launch the browser server, publish its endpoint, and stay alive. */
async function serve(): Promise<void> {
  const server = await chromium.launchServer({ headless: true });
  const state: State = {
    ws: server.wsEndpoint(),
    pid: process.pid,
    browserPid: server.process().pid,
  };
  writeFileSync(STATE, JSON.stringify(state)); // --stop kills both pids
}

async function connect(): Promise<Browser> {
  const state = readState();
  if (state) {
    try {
      return await chromium.connect(state.ws, { timeout: 3_000 });
    } catch {
      rmSync(STATE, { force: true }); // stale: the server died
    }
  }
  const child = spawn(process.execPath, [process.argv[1], "--serve"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 150 && !readState(); i++) await new Promise((r) => setTimeout(r, 100));
  const fresh = readState();
  if (!fresh) throw new Error("shot: the browser server did not start within 15 s");
  return chromium.connect(fresh.ws, { timeout: 5_000 });
}

function stopServer(): void {
  const state = readState();
  // Kill the Chromium tree first, then the server process that launched it.
  for (const pid of state ? [state.browserPid, state.pid] : []) {
    if (!pid) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    else spawnSync("kill", [String(pid)]);
  }
  rmSync(STATE, { force: true });
  console.log(state ? `stopped shot browser (pid ${state.pid})` : "no shot browser running");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--serve")) return serve();
  if (args.includes("--stop")) return stopServer();
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const url = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.match(/^--(w|h|out)$/));
  if (!url)
    throw new Error("usage: shot.ts <url> [--w 390] [--h 844] [--full] [--out path] | --stop");
  const width = Number(flag("--w") ?? 1440);
  const height = Number(flag("--h") ?? 900);
  const out = resolve(flag("--out") ?? join(tmpdir(), `shot-${Date.now()}.png`));
  const t0 = Date.now();
  const browser = await connect();
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: args.includes("--full") });
  } finally {
    await page.close();
    await browser.close(); // disconnects only; the server keeps running
  }
  console.log(`${out} (${width}x${height}, ${Date.now() - t0} ms)`);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
