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
