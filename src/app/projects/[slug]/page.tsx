import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExternalLink from "@/components/ExternalLink";
import { projects } from "@/data/projects";
import { formatMonth } from "@/lib/format";
import { getProjectBySlug } from "@/lib/projects";

export const revalidate = 21600;
export const dynamicParams = false;

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projects.map((project) => ({ slug: project.slug }));
}
