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
