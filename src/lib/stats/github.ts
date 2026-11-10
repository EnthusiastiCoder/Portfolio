import { z } from "zod";
import { siteConfig } from "@/config/site";
import snapshot from "@/data/snapshots/github.json";
import { REVALIDATE_SECONDS } from "./constants";
import type { GitHubRepoSummary, GitHubStats, Sourced } from "./types";

const GITHUB_API = "https://api.github.com";
const MAX_LANGUAGES = 5;
const MAX_FEATURED = 6;
