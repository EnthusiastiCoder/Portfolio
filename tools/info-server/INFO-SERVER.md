# Project info server

A small local server that shows answers and artifacts illustratively, for low cognitive load: a bird's-eye view first, details in stacked modals, and a hover definition for every term.

- **URL:** http://localhost:<port>, where `<port>` is this workspace's entry in the machine-wide port registry (`bun tools/info-server/port.ts lookup`; register once with `port.ts register`). No hardcoded default.
- **Start:** `bun tools/info-server/server.ts` from the repo root, in the background. Check it with `curl localhost:<port>/api/health`. A second start on a taken port fails at once (exit 3); it never shares the port.
- **Stop:** `bun tools/info-server/stop.ts` (`--port N` for another port). It kills the pidfile's process tree plus any bun listening on the port, then checks for itself after up to 5 s: exit 0 only when every process is gone and the port is free. A survivor is named as "stuck in kernel I/O" (Windows cannot end a process with file I/O pending); a listener that is not bun is named, never killed.
- **Soak:** `bun tools/info-server/soak.ts [--minutes 2] [--timeout-ms 2000] [--csv file] [--stress N]`, in the background. It replays the real polling (health 1 s, mtime 5 s, now / artifacts / plan 30 s, page + glossary 60 s), logs every request to the CSV, prints one line per minute and exits 1 when health p95 > 200 ms or any request timed out or failed. Run it after any server change.
- **Server rules:** read-only (GET/HEAD only), localhost only, no dependencies beyond Bun.

## Why it never hangs

Bun runs one event loop, so the rule is simple: **no request ever waits on the disk.**
- **One refresher.** A single timer (`INFO_REFRESH_MS`, default 1 s) reads every content file with async I/O and swaps an in-memory snapshot. A refresh still running is joined, never started twice; while a read that timed out (5 s) is still stuck in the OS, no new refresh starts, so stuck reads never pile up.
- **Handlers read memory.** `/api/*` answer from the snapshot; `/api/health` never touches the disk at all. Files (pages, images, kit) are streamed by Bun, never read synchronously. A broken or half-written JSON file keeps the last good copy.
- **Stalls show as numbers.** `/api/health` reports `stale`, the snapshot's age, how long the last refresh took, pending reads, skipped refreshes, errors and `loop_lag_ms` (the worst event-loop delay of the last 10 s). The home page shows "Stale" when content stops refreshing.
- **Exclusive bind and a pidfile** (`os.tmpdir()/info-server-<port>.pid`) let `stop.ts` find and verify the server.

## Code is shared; content is yours

| Shared (committed) | Yours (gitignored: `tools/info-server/content/`, or `$INFO_CONTENT_DIR`) |
|---|---|
| `server.ts`, `plan.ts`, `home.html` | `now.json`: what you are working on now (the home page) |
| `kit/kit.css`, `kit/kit.js`, `kit/blocks.ts` | `artifacts.json`: your projects and artifacts |
| `check.ts`, `visual-check.ts`, `check-page.ts` | `glossary.json`: your terms and definitions |
| `stop.ts`, `soak.ts`, `port.ts`, this file | `plan.json` (optional): the plan graph; `builders/<id>.ts`, `artifacts/<id>.html`: your pages and screenshots |

Nobody else's artifacts show up on your server, and yours don't show up on theirs. With no content, the server still runs and shows an empty home page.

## Content files

**`now.json`** is the home page. Keep it current; update it whenever the focus changes.
```json
{ "updated": "2026-11-08T12:40:00-03:00", "focus": "Now: …",
  "answer": ["≤ 5 short lines"],
  "status": [{ "label": "…", "state": "done|doing|waiting|blocked|todo", "note": "…",
              "question": "required when waiting: what do you need from me?",
              "options": ["a", { "label": "b", "recommended": true, "note": "why" }] }],
  "pinned": ["artifact-id", { "id": "artifact-id", "label": "optional tooltip", "icon": "≤3 chars" }] }
```
- `state` **`waiting` means waiting on you** (your sign-off, your pick): it shows as "Needs you" on the plan graph and counts in the navbar's "Needs you (n)". Use `blocked` for anything else that is stuck.
- **Every item waiting on you carries a `question`**: one sentence ending in `?` that says exactly what you must decide or do. Where there is a choice, add `options` (2 or more; strings or `{ "label", "recommended", "note" }`, at most one `recommended`). The question shows on the plan node, as the "Needs you" tooltip and alert, and first in the task modal with the options listed and the recommended one marked. check.ts fails any needs-you item without one, because "Waiting on: you" with no question leaves the owner guessing.
- `pinned` artifacts are icon buttons in the navbar (a 2-letter monogram of the title unless `icon` is given; the tooltip and aria-label name it). A pin whose artifact is not registered or whose file is missing stays visible, dimmed and dashed, with the reason. check.ts fails on an unknown or duplicate pin.
- With no `plan.json`, the plan graph is built from `status`: one node per entry, lettered A, B, C…, no dependencies. A note that names an artifact id links the node to that artifact.

**`plan.json`** (optional) is the plan graph: workstreams with dependencies and subtasks. Agents update it as work moves. When it exists it replaces the `status` fallback, so keep it current or delete it.
```json
{ "title": "…", "plan_file": "plans/<file>.md", "updated": "ISO time", "active": "A",
  "steps": [{ "id": "A", "name": "short name", "goal": "…", "status": "done|running|waiting|owner|not_started|failed",
              "waiting_on": "who", "link": "/view/<id>", "note": "…", "updated": "ISO time",
              "question": "required when owner: …?", "options": ["…", { "label": "…", "recommended": true }],
              "depends_on": ["B"], "agent": "agent-name", "plan_section": "WS2",
              "subtasks": [{ "id": "a1", "title": "…", "status": "…", "note": "…", "depends_on": ["a0"], "children": [ … ] }] }] }
```
- `owner` = waiting on you; `waiting` = waiting on someone else. Aliases: `waiting_owner`, `doing`, `todo`, `blocked`. A step or subtask with status `owner` must have a `question` (and `options` where there is a choice), as in now.json.
- `link` must be a same-app path (`/view/<id>`). `depends_on` must name steps (or sibling subtasks) that exist. check.ts validates all of it.
- A step's **latest report** is found by its `agent`/`agents` names: the newest `plans/reports/<YYYY-MM-DDTHH-MM-SS>_<agent>/index.md`, else the newest `plans/handoffs/<ts>_<agent>_<n>.md` (`INFO_PLANS_DIR` overrides `<workspace>/plans`).

## The home page

One screen, no scroll on a desktop. Top to bottom:
- **Navbar:** the plan title (or `focus`), "Plan updated <time ago> · <plan file>" (hover for local and UTC time; ages re-render every 10 s); "Needs you (n)" (opens the first item waiting on you, most specific first) or "Nothing waiting on you"; "Turn on alerts" (browser notifications when the count rises, asked only on click; "Alerts blocked" if refused); the pin icons; "Now | All N artifacts →" (the paged library); the theme toggle. The tab title shows "(n) Project Info".
- **The answer** (`now.json` `answer`, ≤ 5 lines).
- **The plan graph,** filling the rest: columns by dependency depth, arrows for direct dependencies only (teal when the source is done), each node at the mean height of its parents. A node shows its letter, name (wrapped, never cut), status, the question when it waits on you (up to 3 lines), "Needs you" when something under it waits on you, and done/total subtasks; the active step is outlined, items waiting on you glow amber. Zoom and pan: fit to view (100–160%, never below 100%: a big plan pans instead of shrinking text), wheel zooms at the cursor, drag pans (a drag never opens a node), `+` `−` `0` and buttons.
- **Click a node (or Enter):** its **task map**, a centred modal: for an item waiting on you, its **question** first (options listed, the recommended one marked); then status, subtasks done, last update, agent, plan section, "Open page ›", "Latest report" (rendered in place). Subtasks as a **Map** (boxes in columns by `depends_on`, children indented with tree lines) or a **List** (remembered). Esc closes it and focus returns to the node.
- **The strip:** the latest deliverables in one row, newest first, with their age and a "Pinned" mark, and the server's freshness ("Live" or "Stale").

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
   - **home:** the current focus shows, every artifact is reachable in the paged library, and a real first click on "All artifacts" opens it on a cold, slow load (nothing moves after it appears), right after a refresh tick, and a tick never closes it; the plan graph has one node per step, every pin has its icon, and a real click on a node opens its task map (centred, fits, clean); Esc closes it and focus returns to the node;
   - **gallery self-test:** on the result page a real click zooms a screenshot, → shows the next in the same frame, Esc closes only the lightbox;
   - **by design, not defects:** a zoom-pan viewport (`[data-pan]`) clips the scene it pans; a task map's list or report body (`.task-view`) may scroll inside its modal;
   - **kit pages:** the answer is on the first screen, an illustration is drawn, terms are marked, hovering shows a definition (fully on screen), an underlined word opens a stacked modal, and every modal opens with a drawn visual;
   - **legacy pages:** they fill the frame with real content.
   - **kit fit self-test:** `kit/fit-fixture.html`'s height is swept through ~240 near-fit sizes on Arpan's screen; a page that fits must never keep a scrollbar (a 0.3px overflow at 125% used to leave one).
   - **paging self-test:** `kit.pagePlan` (the one paging rule for home's library and every kit paged grid) is swept over 1–60 cards and 4–8 × 1–5 grids, and home's real library is walked with 22–30 artifacts at every desktop size: even pages, no card alone on a row.
   - **retries:** an eval whose page navigates away under it (a live reload) and a first load that never fires its load event are retried once, and every retry is printed (`↻ retry: …`). Any other silence is a failure.

   It publishes its result as the page `info-check` and exits 1 on any ✗. Then look at that page yourself.
7. **Share:** `http://localhost:<port>/view/<id>`. Open pages reload by themselves when their file changes.

Older one-off `.html` files can be registered as `kind: "legacy"`, with an absolute `path`. They are shown in a frame with a Back bar.

## UX rules

- **No scrolling on any bird's-eye page** (home, kit pages) on a desktop screen. kit.js zooms a kit page's bird's-eye to the largest size that fits one screen; long lists go in `pages()`, a paged grid of uniform cards (like the home library), never a scroll. A phone may scroll.
- **Nothing cut off:** no ellipsis, line clamp or hidden overflow hiding text; cards in a row share one height.
- **Hover rings inside the edge:** hover and focus outlines use a negative offset, so a grid or dialog that clips can never cut them.
- **Nothing moves under a click:** home shows only once laid out with its data and font; refreshes re-render only on change and never during a click; a kit page never live-reloads under an open modal or a click.
- **Even rows and pages:** tiles fill their rows evenly (6 tiles → 3 + 3 or one row of 6, never 5 + 1); pages split evenly by count (22 → 11 + 11, 26 at 5 per row → 9 + 9 + 8, never 10 + 10 + 6).
- **Home = what we're working on now** (`now.json`), not any one project. It shows the latest deliverables in at most two rows.
- **Bird's-eye first:** a clear, precise answer of at most 5 short lines, then one illustration and the key-number tiles. It should fit one screen.
- **Details only in modals,** opened one at a time. They stack, and Esc or browser Back closes only the top one. All the data must be reachable, but never all shown at once.
- **Illustrations lead:** every modal starts with a visual. Text after it is at most 3 short lines.
- **No walls of text:** no paragraph over 240 characters.
- **Every jargon term has a hover definition.** Definitions use plain words, at most 2 sentences and 200 characters. If a definition must use another term, write it `[[key]]`: it renders underlined and opens that term's own modal on top.
- **Every chart has a legend or caption** that says what it means. Missing data is "not measured", never 0.
- **Modals are centred** (never pinned to the top); only home's library is top-aligned, so its pager never moves under the cursor.
- **Type floor:** nothing under 13px as drawn; a zoomed scene never fits below 100%.
- **Images zoom:** screenshots go in `gallery()`; a click opens a lightbox (Previous / Next, ← / →, Esc).

## Kit page contract

```html
<body data-artifact="<id>">                     ← enables live reload
<main class="kit-page kit-birdseye"> answer · visual · tiles </main>
<section class="kit-modal-src" id="m-<x>" data-title="…" hidden> visual · lead · extra </section>
<button data-kit-open="<x>">  /  <g class="kit-node" data-kit-open="<x>">   ← opens modal x
<div class="kit-pages"> <div class="kit-grid"> .kit-card … </div></div>       ← blocks.pages(): paged grid, last block
<div class="kit-gallery"> <button class="kit-shot" data-kit-zoom="0"><img src="x.png"> … </div>  ← blocks.gallery(): click to zoom
<script src="/kit/kit.js"></script>
```

`blocks.gallery([{ src, caption }])` goes inside `visual()`; every `src` must be an image next to the page (check.ts fails on a missing one). `window.kit.openLayer(title, node, { cls, head, onClose, returnFocus })` opens any custom stacked modal (home's task map uses it).
