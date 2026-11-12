import Link from "next/link";
import FeaturedRepos from "@/components/FeaturedRepos";
import SectionHeading from "@/components/SectionHeading";
import { formatMonth } from "@/lib/format";
import { getAllProjects } from "@/lib/projects";
import type { GitHubRepoSummary } from "@/lib/stats/types";
