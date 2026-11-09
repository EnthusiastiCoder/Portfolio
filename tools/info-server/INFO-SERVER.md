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

**`glossary.json`**
```json
{ "version": 1,
  "terms": { "key": { "label": "…", "aliases": ["…"], "definition": "plain words; [[otherKey]]" } } }
```

## How to publish an answer or artifact

1. **Write a builder:** `content/builders/<id>.ts`, importing blocks from `../../kit/blocks`. Compute every number and coordinate from data; never hand-draw.
2. **Run it:** `bun tools/info-server/content/builders/<id>.ts`. It writes `content/artifacts/<id>.html`.
3. **Register it:** add or update its entry in `content/artifacts.json`. If it belongs to the current focus, add it to `now.json` `pinned`.
4. **Define new jargon:** add each new term to `content/glossary.json`.
5. **Check the files:** `bun tools/info-server/check.ts`.
6. **Check it visually:** `bun tools/info-server/visual-check.ts` (separate from step 5; `ONLY=id,id` re-checks a few pages). It opens everything in a headless Edge/Chrome (`BROWSER_EXE` overrides the browser) at Arpan's screen first (**1529×837 at 125% scaling, in a real browser window with real scrollbars**, not an emulated viewport), then 1280×720, 1440×900, 1920×1080 and a 412-wide phone, and checks:
   - **every bird's-eye page** (home, kit pages, the result page itself) on desktop: no page scroll, and at least 70% of the screen used (no big gutters or empty half-screens);
   - **everywhere, including every modal and the library:** no sideways scroll, nothing clipped by `overflow: hidden`, no text cut by an ellipsis or line clamp, every SVG label inside its viewBox and its box, nothing overlapping, no scrolling box inside the page, and every dialog fully on screen, diagram text at least 12px as drawn, paged grids split evenly with no card alone on a row, and every hoverable or focusable element's hover/focus ring fully drawn (forced `:hover`/`:focus-visible`, never cut by a clipping grid or dialog);
   - **home:** the current focus shows, every artifact is reachable in the paged library, and a real first click on "All artifacts" opens it on a cold, slow load (nothing moves after it appears), right after a refresh tick, and a tick never closes it;
   - **kit pages:** the answer is on the first screen, an illustration is drawn, terms are marked, hovering shows a definition (fully on screen), an underlined word opens a stacked modal, and every modal opens with a drawn visual;
   - **legacy pages:** they fill the frame with real content.
   - **kit fit self-test:** `kit/fit-fixture.html`'s height is swept through ~240 near-fit sizes on Arpan's screen; a page that fits must never keep a scrollbar (a 0.3px overflow at 125% used to leave one).
   - **paging self-test:** `kit.pagePlan` (the one paging rule for home's library and every kit paged grid) is swept over 1–60 cards and 4–8 × 1–5 grids, and home's real library is walked with 22–30 artifacts at every desktop size: even pages, no card alone on a row.
   - **retries:** an eval whose page navigates away under it (a live reload) and a first load that never fires its load event are retried once, and every retry is printed (`↻ retry: …`). Any other silence is a failure.

   It publishes its result as the page `info-check` and exits 1 on any ✗. Then look at that page yourself.
7. **Share:** `http://localhost:<port>/view/<id>`. Open pages reload by themselves when their file changes.
