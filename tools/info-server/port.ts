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
