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
