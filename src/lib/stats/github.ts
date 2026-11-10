import { z } from "zod";
import { siteConfig } from "@/config/site";
import snapshot from "@/data/snapshots/github.json";
import { REVALIDATE_SECONDS } from "./constants";
import type { GitHubRepoSummary, GitHubStats, Sourced } from "./types";
