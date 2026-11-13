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
