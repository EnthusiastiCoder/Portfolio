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

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return {};
  const url = `/projects/${project.slug}`;
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: project.title, description: project.summary },
    twitter: { card: "summary_large_image", title: project.title, description: project.summary },
  };
}
