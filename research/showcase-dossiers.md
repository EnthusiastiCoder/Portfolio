# Showcase dossiers (2026-11-14)

Capability dossiers for the showcase candidates, written from each repo's code, README and git log.
All audited repos were read-only: no edits, no installs, no remotes touched. Tests were run only where
the dependencies were already present, with bytecode and pytest caches off; `git status` was identical
before and after each run. No secret values appear here.

Brief: `plans/2026-11-14_showcase-capability-research.md`. Source of folder list and scores:
`C:\Users\enthu\Projects\repo-publisher\out\audit.json`.

## At a glance

| Project | Audit score | What it is | Code size | Commits (span) | Last commit | Tests (my run) | Public plan |
|---|---|---|---|---|---|---|---|
| MONDAY | 88 | Fully local, multimodal desktop AI assistant | ~14.0k LOC, Py + TSX | 633 (Jul 21-29 2026) | 2026-07-29 | 231 pass, 2 skip, 1 env-only fail | Case study only, code private |
| PublishPal | 87 | Linter for research papers: LaTeX source + rendered PDF | ~8.5k LOC, Py + TSX | 72 (one day, Sep 2 2026) | 2026-09-02 | 380 pass | Public |
| StickFighter | 86 | Stickman archery duel with a PPO self-play AI | ~6.1k LOC, Py | 157 (Sep 4-9 2026) | 2026-09-09 | 132 pass (dirty tree) | Public |
| Music Player (SyncPlay) | 81 | Desktop player with word-level karaoke lyric overlay | ~5.4k LOC, Py | 42 (Mar 13 2026) | 2026-03-13 | 56 of 141 run, all pass (Qt not installed) | Public |
| cto-orchestrator | 82 | Claude Code mod that runs a session as a CTO with employee agents | ~2.5k LOC, TS + Py | 19 (Oct 9-21 2026) | 2026-10-21 | 89 pass | Undecided |
| ResearchX | 82 | Self-hosted P2P research agent harness: no claim without a citation | ~84k LOC, Py + SQL + TS | 936 (Aug 9-31 2026) | 2026-08-31 | not run (see below) | Undecided |
| CNProj (SecureLAN) | 80 | E2E-encrypted LAN messenger + file transfer | ~3.5k LOC, Py | 40 (Apr 20 2026) | 2026-04-20 | 45 pass | Undecided |
| NaturEvo | 77 | Deterministic Rust sims: jungle RPG, then neuroevolved fighters | ~34.7k LOC, Rust + TS | 765 (Oct 21-26 2026) | 2026-10-26 | not run | Undecided |

---

## 1. MONDAY (deep; case study only)

**What it is:** a fully local, multimodal AI assistant for the desktop that listens, sees and chats,
and acts inside its own notes/diary ecosystem, with nothing leaving the machine by default.

### Capabilities (verified in code)
- **Chat with tool use**: an orchestrator loop (prompt, LLM, tool calls, results, reply) over a typed
  action registry with 21 actions: notes (create, list, get, search), diary (create, list),
  `remember_fact`, `create_skill`, `take_photo`, `describe_image`, `capture_screen`, `record_video`,
  runtime placement (get, set, list endpoints), `mark_chat_handled`, `web_search`, and four web tools
  proxied through an on-demand MCP server (`fetch_url`, `extract_tables`, `extract_links`, `read_pdf`).
- **Local brain**: Ollama client with tool calling (default `qwen3:4b`; README still says Qwen 2.5 7B),
  plus an OpenAI-compatible client so any component can run on a cloud endpoint instead. Reasoning
  models' `<think>` output is streamed dimmed, never spoken or stored.
- **Voice, always-listen loop**: wake word (openWakeWord), energy VAD, streaming speech-to-text
  (faster-whisper with a LocalAgreement-2 commit policy, so the transcript is ready when you stop),
  TTS (Piper or Kokoro), barge-in by saying the wake word, mic muted during TTS to stop echo, and
  speaking only a gist of long replies. Voice sessions persist as conversations.
- **Vision**: a small VLM (moondream) describes photos, screenshots and sampled video frames; camera
  capture via DirectShow so it can share the webcam with a running video call.
- **Privacy gate**: "Perceptive Access" is a single persisted switch, default OFF; no capture backend
  may open a camera or mic while it is off. An egress indicator glows when any component talks to a
  cloud endpoint. Cloud secrets are stored only as env-var names, never in the DB.
- **Memory that asks first**: candidate memories are extracted from chats, but only user-approved
  memories are embedded (nomic-embed-text) and recalled. Plus reflections (lessons from conversations
  and tool failures) and a skills library (procedures Monday can propose; only approved ones are used).
- **Honesty layer**: an immutable honesty core in the system prompt, a deterministic "did you actually
  do that?" check against the tools that really ran this turn, and an optional re-grounding rewrite.
- **Self-improvement**: an eval battery (tool use + honesty cases) scores the assistant; a GEPA-style
  optimizer rewrites only the editable persona and keeps a candidate only if it scores higher.
- **Runtime placement**: a matrix decides where each component (LLM, embeddings, STT, TTS, VLM) runs:
  CPU, GPU, hybrid, or a named cloud endpoint. GPU OOM is retried with a halved context.
- **UI**: React chat with editable messages and branching (message tree, version arrows, a snaking
  branch graph), notes, diary, "Mind" / "Growth" views of memories and skills, a character dashboard,
  inline media, and an always-on-top quick-chat widget on Ctrl+Alt+Space. Hosted in a Tauri window.
- **Observability**: per-channel structured JSONL logs with request IDs, GPU/RAM metrics via NVML and
  psutil, optional log redaction.

### Stack and architecture
Python 3.12, FastAPI (loopback only), SQLModel over SQLite with FTS5; Ollama (LLM, embeddings, VLM);
faster-whisper, openWakeWord, Piper/Kokoro; MCP client; Vite + React + Tailwind in Tauri (Rust shell).

```
 mic/cam --[Perceptive Access gate]--> wake word -> streaming STT ----+
 Tauri window (React UI, widget) --HTTP/SSE/WS--> FastAPI (127.0.0.1) |
                                                     |                v
                              memories/skills/lessons -> Orchestrator -> LLM (Ollama or cloud)
                                     (approved only)         |  tool calls
                                                             v
               notes, diary, camera, screen, VLM, web search, MCP web tools
                                                             |
                     honesty check -> reply -> TTS / UI    SQLite + FTS5   JSONL logs + GPU metrics
```

### Status and quality
- 633 commits in 9 days (Jul 21-29 2026), version 0.4.0, GitHub repo private, 38 test files.
- My run: `231 passed, 2 skipped, 1 failed`. The one failure is `test_config.py::test_derived_paths_and_urls`,
  caused only by my redirecting the data dir to a scratch folder (so the run wrote nothing in the repo).
- Rough edges: README stack line is stale (model and phase); open issues for a custom "Hey Monday" wake
  word and persistent interactive browsing; Windows-only capture paths; tuned for one 6GB-VRAM box.
- Two untracked files in the worktree (`mistakes/`, `plans/computer-use.md`).

### Showcase angle
The strongest project. Highlight: fully local voice + vision + tools on a 6GB GPU; privacy by design
(default-off sensors, egress light); honesty enforced in code, not prompt; memory with consent;
self-evaluating and self-tuning persona. Visuals needed: a 30-60 s screen recording (wake word, ask,
it takes a note, describes the camera view), screenshots of the branch graph, Mind/Growth views and the
placement matrix, and an architecture diagram. No live demo (local GPU), so video is the demo.

### Public case-study outline (no code, no secrets)
1. **Problem**: cloud assistants send every word and frame off the device, and small local models
   overclaim ("I've saved that") when nothing happened.
2. **Constraints**: one consumer laptop, 6GB VRAM, tight RAM; everything must work offline.
3. **Approach**: a local orchestrator with a small tool-calling model; short tool chains because small
   models degrade past a few hops; every sensor behind one default-off switch; any component can move
   to the cloud by choice, with a visible indicator.
4. **Capabilities**: talk to it hands-free (wake word, streaming STT, natural TTS, barge-in); it sees
   (photos, screen, video); it keeps notes and a diary; it remembers only what you approve; it learns
   skills and lessons; branching conversations; quick-chat widget.
5. **Trust engineering**: an immutable honesty core, a deterministic action-truth check, re-grounding,
   and an eval battery that drives automatic persona tuning.
6. **Results**: 21 tools, 5 swappable model components, 230+ automated tests, built in 9 days
   (633 commits). Add measured numbers before publishing: wake-to-reply latency, VRAM use, eval score
   before vs after persona tuning.
7. **What's next**: custom wake word, on-device phone companion (see the concept brief below).

### What we could add (impact for effort)
1. Measure and publish latency, VRAM and eval-score numbers (high impact, low effort; feeds the case study).
2. A demo video plus annotated screenshots (high, low).
3. Custom "Hey Monday" wake word (medium, medium).
4. Reminders/tasks/alarms as tools (shared design with the phone assistant) (medium, medium).
5. Phone companion that syncs notes over the tailnet (high, high).

---

## 2. PublishPal (deep)

**What it is:** a linter that checks a research paper against a supervisor's actual rules, in the LaTeX
source and on the rendered PDF page, and maps each finding back to the source line.

### Capabilities (verified in code)
- **Declarative YAML rules** (Vale-style, LaTeX-aware) with 8 check types: existence, substitution,
  occurrence, structure, spacing, sequence, metric, geometry.
- **32 shipped rules** in profiles: shared (style, notation, citations, structure, rendered), paper,
  thesis. Each rule records where the feedback came from.
- **19 non-deterministic rules documented, not faked**: one file each saying what was asked and why it
  cannot be checked mechanically yet (the backlog for a future LLM layer).
- **LaTeX document model**: parser (pylatexenc), sections, elements, citations, bibliography, positions.
- **Rendered-page geometry**: compiles with latexmk, reads PDF geometry with PyMuPDF, maps boxes back to
  source lines via SyncTeX, and can write annotated page images with boxes.
- **CLI**: `lint` (text/JSON, `--no-render`, `--annotate`), `rules --profile`, `serve`; distinct exit
  codes for clean / findings / bad usage / did not compile.
- **Web app**: FastAPI backend with SQLite (Alembic migrations), React frontend with Source view,
  Page view (findings drawn on the page), Findings panel and Rules view.
- Synthetic fixture papers (`sample-paper` with `expected.yaml`, `clean-paper`) drive the tests.

### Stack and architecture
Python 3.11+, pylatexenc, PyMuPDF, Pydantic, PyYAML, FastAPI, SQLAlchemy + Alembic; MiKTeX/TeX Live
(latexmk, synctex); Vite + React + TypeScript.

```
 main.tex --> LaTeX parser --> document model --+--> rule engine (YAML rules, 8 checks) --> findings
          \                                     |                                          |
           --> latexmk -> PDF -> geometry ------+   SyncTeX maps page boxes -> source lines |
                                                                                           v
                                   CLI (text/JSON/annotated PNG)  |  FastAPI + SQLite -> React (source + page views)
```

### Status and quality
- 72 commits in one day (2026-09-02), all 9 milestones marked done. No GitHub remote yet. Clean tree.
- My run: `380 passed in 50.29s` (`PYTHONPATH=. python -m pytest` in `backend/`, global Python; MiKTeX present).
- Rough edges / hardening: rule `source:` lines quote WhatsApp messages and name a third person; scrub
  or generalize before publishing. No CI. Credits to Paper-Linter (MIT) are already in the README.

### Showcase angle
"Turn reviewer feedback into a lint that catches it forever." A clear, relatable problem with a strong
visual: the page view with boxes over the offending figure next to the source line. Needs: screenshots
of the page and source views, a short GIF of lint, click a finding, jump to line. A live demo is
possible with the CLI on the fixture paper; a hosted demo would need TeX in a container.

### What we could add
1. Scrub rule sources, add a GitHub Action running the tests, publish (high, low).
2. A hosted demo: upload a zip, get annotated pages (Docker with TeX Live) (high, medium).
3. "Feedback to rule" helper: paste a comment, get a draft YAML rule (LLM-assisted, human-approved) (high, medium).
4. The planned LLM layer for the 19 documented non-deterministic rules (medium, high).
5. VS Code / Overleaf integration showing findings inline (medium, medium).

---

## 3. StickFighter (deep)

**What it is:** a stickman archery duel game (Archers 2 style) whose deterministic headless simulation
doubles as a Gymnasium environment for training a PPO self-play opponent.

### Capabilities (verified in code)
- **Game**: two archers on floating platforms; drag to aim and set draw strength; headshots kill, body
  shots chip; WASD/arrows move and jump; pause, rematch, gore toggle; coins saved to `save.json`.
- **Difficulty ladder**: Bronze/Silver/Gold scripted bots (ballistic aim with noise), Legend = the newest
  trained checkpoint (falls back to a perfect-play bot); Spectate mode watches two AIs fight.
- **Pure core**: physics, ballistics, rules and match state machine with no pygame/torch/gym imports;
  the renderer only reads snapshots.
- **RL pipeline**: Gymnasium `DuelEnv` with frame-skip, vectorized envs (Sync vs Async benchmarked and
  documented), custom PPO, curriculum S0 static target, S1 noisy bot, S2 sharp bot, S3 self-play against
  a league of frozen past checkpoints with Elo; resume; `evaluate.py` gives win rate vs the bot ladder
  and records matches to GIF/MP4 through the real renderer.
- **Horde highlight scenario**: a scripted hero archer vs waves of melee enemies, cloud archers, hounds
  and dragons, rendered to `horde_demo.mp4` (8 MB) for a highlight video.
- Training evidence on disk: the main run reached ~40M steps in ~5.2 h, curriculum stage 3 (self-play),
  rolling win rate 1.0, league of 30 frozen checkpoints, 90 checkpoints saved.

### Stack and architecture
Python 3.12, pygame-ce, pymunk (render-side ragdolls), NumPy, PyTorch (CUDA), Gymnasium, tensorboardX,
imageio.

```
            stickfighter/core (pure, deterministic sim)
             /                 |                     \
 render (pygame) <- game app   ai/envs DuelEnv x N    core/horde (scripted highlight)
   ^  menus, input, save        |                         |
   |                            v                         v
   +-- Legend checkpoint <- PPO + curriculum + league -> checkpoints, TB logs, GIF/MP4 eval
```

### Status and quality
- 157 commits Sep 4-9 2026, no GitHub remote. Worktree is dirty: 6 modified files (horde work in
  progress) plus untracked `research/` and `render/assets/`.
- My run: `132 passed, 1 deselected in 58.31s` (global Python 3.12, on the dirty tree).
- Rough edges: relies on a shared global Python env (no venv; torch CUDA pinned); training artifacts
  under `runs/` must stay out of git; the horde mode is a video scenario, not a playable mode.

### Showcase angle
Very visual. Lead with the horde MP4 (cut to 10-20 s) and a GIF of the trained Legend AI landing a
headshot. Second panel: the curriculum chart (win rate and Elo by stage from the progress CSV).
A browser demo is possible later (pygame-ce via pygbag, scripted bots only).

### What we could add
1. Commit the horde work, trim the demo video, add a training-curve chart to the README (high, low).
2. Playable web build with pygbag (scripted bots, maybe a small ONNX policy) (high, medium).
3. Make Horde a playable survival mode (medium, medium).
4. Export the policy to ONNX and run it in-browser so visitors can fight the Legend AI (high, medium).
5. Local two-player and an online leaderboard (low, medium).

---

## 4. Music Player, "SyncPlay" (deep)

**What it is:** a Windows desktop music player that shows word-level synchronized lyrics in a
transparent always-on-top overlay, with an offline Whisper forced-alignment tool to make the timings.

### Capabilities (verified in code)
- **Player**: Qt Multimedia playback (MP3/WAV/OGG/FLAC), playlist with repeat Off/All/One, shuffle,
  folder loading, system tray controls, single-instance guard, keyboard shortcuts, 5 QSS app themes.
- **Lyric overlay**: click-through transparent window with word-by-word highlight repainted at 30 Hz,
  hold-to-drag edit mode, resize grip, auto width, fade on pause and auto-hide after 5 s.
- **WLRC format**: a JSON word-level lyric format; read/write, sidecar auto-detection, and embedding in
  MP3 ID3 tags (`TXXX:WLRC`) with auto-extract on playback.
- **Alignment tool**: stable-ts (Whisper) forced alignment of a transcript to audio, CUDA when available,
  model manager, SRT input, auto-embed into the MP3; fetches plain lyrics from the lrclib.net API.
- **Overlay themes**: 6 presets plus custom themes with live preview; subtitle viewer tab to inspect
  per-word timings and extract WLRC from MP3s.
- Rough edge: the "visualizer" is decorative (random animated bars, not an FFT of the audio).

### Stack and architecture
Python 3.11+, PyQt6 (+ QtMultimedia), mutagen, stable-ts / openai-whisper (torch), PyInstaller.

```
 audio file --> AudioEngine (QMediaPlayer) --> PlaybackClock (30 Hz) --> LyricRenderer --> Overlay window
      |                                                                     ^
      +--> ID3 TXXX:WLRC / .wlrc sidecar ----------------------------------+
 lrclib.net lyrics + audio --> stable-ts (Whisper) aligner --> WLRC --> embed into MP3
```

### Status and quality
- 42 commits on 2026-03-13 (one day), GitHub repo private, PyInstaller build config present.
- My run: PyQt6 is not installed globally and I did not install it, so only the non-Qt tests ran:
  `56 passed in 0.54s` (`test_wlrc`, `test_time_utils`, `test_lrclib_client`). The suite has 141 tests;
  the commit log reports 118 passing at M9.
- Hardening: the working folder holds a commercial MP3, its SRT and WLRC (untracked; must never be
  committed or shown); loose `diag_*.py` scripts at the root; Windows-only (named mutex, tray).

### Showcase angle
Karaoke-style overlay is instantly understandable. Needs a GIF of the overlay highlighting words over
a desktop, using a royalty-free or self-recorded track (not the commercial one), and a screenshot of the
alignment tab. No live demo (desktop app); a release `.exe` on GitHub works as the demo.

### What we could add
1. Real audio-reactive visualizer (FFT via QAudioBufferOutput) (medium, low).
2. Published Windows release (`.exe`) built by a GitHub Action (high, low).
3. One-click "find lyrics + align" for a whole library, batch in the background (high, medium).
4. Rename the public repo to SyncPlay and record a demo with a CC-licensed song (high, low).
5. Cross-platform (macOS/Linux) by replacing the Windows-only bits (medium, medium).

---

## 5. cto-orchestrator (short)

**What it is:** a Claude Code mod that turns the main session into a "CTO" that plans with the user and
delegates to employee agents (planner, test-writer, implementers, verifiers) with context budgets and
handoffs.
- **Capabilities**: hooks for roles, steering messages, context metering per agent, check-ins at
  thresholds, self-written handoffs at 150k (250k for `-xl`), a report tool (10-line summaries plus
  detail sections), status view, `/cto-align`, `/cto-handoff`, `/cto-status`; an e2e harness comparing
  CTO mode vs a control run on a fixture coding task, with token metrics.
- **Stack**: TypeScript hooks on Claude Code's plugin API, Python e2e harness.
- **Status**: 19 commits Oct 9-21 2026 (history continues on a branch of `UI CRITIQUE`); clean tree.
  My run: `claude plugin test mods/cto-orchestrator` gives `89 pass, 0 fail`. Plain `bun test` fails
  only because `claude-code/testing` resolves inside the plugin runner.
- **Showcase angle**: an honest experiment write-up: on a task that fits one agent, delegation is
  overhead; the savings case needs long tasks (documented in its research notes). Visual: org chart and
  a token-cost bar chart CTO vs control.
- **Add**: run the long-task cost experiment and publish numbers (high, medium); a public install guide
  without local paths (medium, low); a dashboard of live agents (medium, medium).

## 6. ResearchX (short)

**What it is:** a self-hosted, peer-to-peer research agent harness where a claim cannot exist without
a quoted source, enforced by the database schema.
- **Capabilities** (README and state doc): evidence ledger (claims tied to document spans, corrections
  supersede, verification by a different actor), retrieval and analysis, provider registry with
  credential pool, router and governor, literature adapters, research swarm and scheduler, domain
  presets (e.g. regulatory), FastAPI node with its own client, a sealed relay queue so a friend can use
  it from a Vercel Next.js frontend with nothing connecting inbound; 12 phases, 35 capabilities, schema v38.
- **Stack**: Python (uv workspace, 5 packages), SQLite and Postgres migrations (reversible), FastAPI,
  Next.js on Vercel, Supabase (planned), SearXNG (vendored).
- **Status**: 936 commits Aug 9-31 2026, CI workflow present, README claims 2,584 Python + 97 TS tests.
  I did not run them: the env needs `uv sync` (an install) and tests touch storage. Worktree has 5
  modified relay migration/doc files. Audit: 3 secret findings in history, so it needs a fresh repo;
  the vendored `.searxng` is third-party and must be excluded. Open gaps: a real job has never crossed
  the relay; relay never run on Postgres.
- **Showcase angle**: "no claim without evidence" as a design principle; the gap register as a sign of
  engineering honesty. Visual: claim-to-source graph.
- **Add**: fresh public repo with the vendored code removed (high, medium); a recorded demo of one
  research question end to end (high, low); close G51/G52 (medium, medium).

## 7. CNProj, "SecureLAN" (short)
