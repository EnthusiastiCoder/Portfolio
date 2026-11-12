import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExternalLink from "@/components/ExternalLink";
import { projects } from "@/data/projects";
import { formatMonth } from "@/lib/format";
import { getProjectBySlug } from "@/lib/projects";
