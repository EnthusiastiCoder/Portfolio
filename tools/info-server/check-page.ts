// Builds artifacts/info-check.html from the visual check's results (called by visual-check.ts).
import { join } from "node:path";
import { CONTENT } from "./server";
import type { Result } from "./visual-check";
import { answer, esc, modal, page, pages, tiles, visual } from "./kit/blocks";
