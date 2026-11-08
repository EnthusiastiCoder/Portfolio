# Project info server

A small local server that shows answers and artifacts illustratively, for low cognitive load: a bird's-eye view first, details in stacked modals, and a hover definition for every term.

- **URL:** http://localhost:<port>, where `<port>` is this workspace's entry in the machine-wide port registry (`bun tools/info-server/port.ts lookup`; register once with `port.ts register`). No hardcoded default.
- **Start:** `bun tools/info-server/server.ts` from the repo root, in the background. Check it with `curl localhost:<port>/api/health`.
- **Server rules:** read-only (GET/HEAD only), localhost only, no dependencies beyond Bun.

## Code is shared; content is yours

| Shared (committed) | Yours (gitignored: `tools/info-server/content/`, or `$INFO_CONTENT_DIR`) |
|---|---|
| `server.ts`, `home.html` | `now.json`: what you are working on now (the home page) |
| `kit/kit.css`, `kit/kit.js`, `kit/blocks.ts` | `artifacts.json`: your projects and artifacts |
| `check.ts`, `visual-check.ts`, `check-page.ts` | `glossary.json`: your terms and definitions |
| this file | `builders/<id>.ts` and `artifacts/<id>.html`: your pages and screenshots |

Nobody else's artifacts show up on your server, and yours don't show up on theirs. With no content, the server still runs and shows an empty home page.

## Content files

**`now.json`** is the home page. Keep it current; update it whenever the focus changes.
```json
{ "updated": "2026-11-08T12:40:00-03:00", "focus": "Now: …",
  "answer": ["≤ 5 short lines"],
  "status": [{ "label": "…", "state": "done|doing|waiting|blocked|todo", "note": "…" }],
  "pinned": ["artifact-id", "…"] }
```

**`artifacts.json`**
```json
{ "version": 1,
  "projects": [{ "id": "recsys", "title": "…", "linear": "P-MY-23", "headline": "…" }],
  "artifacts": [{ "id": "a-z0-9-", "title": "…", "kind": "kit|legacy", "path": "legacy: absolute path",
                  "project": "recsys", "topic": "…", "headline": "…" }] }
```
