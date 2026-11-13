# Arpan Mandal — Portfolio

A personal portfolio with a Matrix-inspired design: a terminal-style layout over full-screen digital rain, a red pill / blue pill effects switch, and live GitHub and LeetCode stats.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router, Turbopack) and React 19
- TypeScript, Tailwind CSS v4, MDX for project write-ups
- `motion` (LazyMotion) for reveal animations
- zod for validating the stats APIs
- Vitest + Testing Library (unit), Playwright + axe-core (end-to-end and accessibility)
- `@lhci/cli` for the local Lighthouse gate
- pnpm, Node 24

## Development

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Copy `.env.example` to `.env.local` if you need any of the optional variables (`GITHUB_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `STATS_SOURCE`).

## Scripts

| Script                  | What it does                                                              |
| ----------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`              | Dev server                                                                |
| `pnpm build`            | Production build                                                          |
| `pnpm start`            | Serve the production build on port 3000                                   |
| `pnpm lint`             | ESLint                                                                    |
| `pnpm typecheck`        | `next typegen` + `tsc --noEmit`                                           |
| `pnpm format`           | Prettier (write)                                                          |
| `pnpm format:check`     | Prettier (check)                                                          |
| `pnpm test`             | Vitest unit tests                                                         |
| `pnpm e2e`              | Playwright end-to-end and axe tests (builds and starts its own server)    |
| `pnpm snapshot:refresh` | Refetch the GitHub and LeetCode stats and rewrite the committed snapshots |
| `npm run lighthouse`    | Local Lighthouse gate, mobile and desktop (see below)                     |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, format check, unit tests and the build, then the Playwright end-to-end suite with `STATS_SOURCE=snapshot`.

## Lighthouse (local only)

```bash
npm run lighthouse
```

`scripts/lighthouse.mjs` builds the site with `STATS_SOURCE=snapshot`, then runs `lhci autorun` twice, 3 runs per URL on `/` and `/projects/matrix-portfolio`:

- `lighthouserc.json` (mobile, the default): performance >= 0.90; accessibility, best practices and SEO >= 0.95.
- `lighthouserc.desktop.json` (desktop preset): performance >= 0.95; accessibility, best practices and SEO >= 0.95.

It exits non-zero if either run misses a threshold. Reports are written to `.lighthouseci/` and `.lighthouseci/desktop/` (gitignored); nothing is uploaded.

**Why not in CI:** performance scores on shared CI runners are noisy (other jobs share the CPU), so a performance gate there is flaky, and Lighthouse needs a real Chrome. It is a local pre-release check instead.

**Which browser:** set `CHROME_PATH` to use a specific Chromium-based browser. Without it, the script uses Playwright's bundled Chromium (`pnpm exec playwright install chromium`). On Windows you can use Edge:

```powershell
$env:CHROME_PATH = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
npm run lighthouse
```

## How the stats work

- The home page fetches GitHub and LeetCode stats on the server and validates every response with zod (`src/lib/stats/`).
- Responses are cached and revalidated every 6 hours (`revalidate = 21600`).
- If a live fetch fails or does not validate, the page falls back to the committed snapshots in `src/data/snapshots/` and shows a "Stats as of" date.
- `STATS_SOURCE=snapshot` skips the network entirely and always uses the snapshots. CI, the end-to-end tests and the Lighthouse script use it so builds are deterministic.
- `pnpm snapshot:refresh` refetches both sources and rewrites the snapshots (set `GITHUB_TOKEN` for a higher rate limit).

## Placeholder content to replace

| What                              | Where                                    |
| --------------------------------- | ---------------------------------------- |
| Name, headline, bio               | `src/data/profile.ts`                    |
| Project list and featured flags   | `src/data/projects.ts`                   |
| Project write-ups                 | `src/content/projects/*.mdx`             |
| Work history                      | `src/data/experience.ts`                 |
| Skills                            | `src/content/skills.ts`                  |
| Resume                            | `public/resume.pdf`                      |
| LinkedIn link (currently generic) | `links.linkedin` in `src/config/site.ts` |

## Matrix rain

The rain (`src/components/matrix/`) is loaded with `next/dynamic` only after `load` and an idle callback, so it never competes with the first paint or LCP. The canvas is fixed behind the content, `aria-hidden` and ignores pointer events. Its `data-mode` attribute tells you which mode is running:

- **worker**: the default in Chromium. The canvas is transferred to an `OffscreenCanvas` in a Web Worker, so animation never blocks the main thread.
- **main-thread**: the fallback where `OffscreenCanvas` is unavailable; frames are throttled to the budgeted fps with `requestAnimationFrame`.
- **static**: one still frame. Used under `prefers-reduced-motion: reduce`, Save-Data, or the calm effects level.

**Adaptive budget** (`src/lib/rain.ts`): the frame-rate cap, column density and device-pixel-ratio cap depend on the device. 8+ cores and 8+ GB memory get 30 fps at full density; 4 or fewer cores or 4 GB or less get 20 fps at half density; everything else gets 24 fps. The rain also pauses when the tab is hidden or the hero is scrolled out of view.

**Reduced motion and the calm pill:** under reduced motion the rain is static and all CSS animations are off. The hero's "Blue pill · calm" button switches to the calm level (static rain, no glitch or decode effects); "Red pill · full effects" switches back and replays the glitch. The choice is stored in `localStorage` and applied before first paint, and page content is never gated behind it.

## Project info server
