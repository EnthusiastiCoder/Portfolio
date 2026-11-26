# shot

A screenshot CLI for agents. Every shot reuses one long-lived headless
Chromium, so only the first shot pays for the browser launch.

```sh
bun tools/shot/shot.ts <url> [--w 1440] [--h 900] [--full] [--out path]
bun tools/shot/shot.ts --stop
```

- `--w`, `--h`: the viewport (default 1440 x 900; a phone is `--w 390 --h 844`).
- `--full`: the whole page, not just the viewport.
- `--out`: where the PNG goes (default: a timestamped file in the temp folder).
  The path and the time taken are printed.
- `--stop`: kills the browser. Run it when you are done.

The first call starts the browser in a detached process (Playwright
`launchServer`) and saves its WebSocket endpoint to
`<tmp>/agent-shot-browser.json`. Later calls connect to it, open a page, wait
for `load` and the fonts, take the shot and disconnect. If the browser has died,
the next call starts a new one.

Needs `pnpm install` (it uses the repo's Playwright and its Chromium).
