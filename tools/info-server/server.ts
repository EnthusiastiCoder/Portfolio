// Project info server — shows answers and artifacts illustratively: bird's-eye first, details in
// stacked modals, hover definitions. Local only, read-only. Run: bun tools/info-server/server.ts
// The port comes from the machine-wide registry (port.ts): register the workspace once first.
//
// CODE is shared (this folder). CONTENT is each person's own and gitignored: content/ (or
// $INFO_CONTENT_DIR) holds now.json, artifacts.json, glossary.json, artifacts/, builders/.
//
//   /                     home: what we are working on now + latest deliverables; library in a modal
//   /a/<id>/              a kit page (content/artifacts/<id>.html)
//   /view/<id>            any artifact (legacy files framed with a Back bar)
//   /raw/<id>             a legacy file itself
//   /api/now | /api/artifacts | /api/glossary | /api/mtime?id=<id> | /api/health
//   /kit/*                kit.css, kit.js
//
// Rules: GET/HEAD only; Host must be localhost/127.0.0.1; no-store on /api.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { resolvePort } from "./port";
