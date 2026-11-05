"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";

const ALL_SECTIONS = [
  { id: "about", label: "About" },
  { id: "projects", label: "Products" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
] as const;

const SECTIONS = ALL_SECTIONS.filter((s) => s.id !== "experience" || siteConfig.showExperience);

/**
 * Right-edge section nav made of real in-page links (keyboard, find-in-page
 * and screen readers keep working). The section nearest the middle of the
 * viewport is marked aria-current. Hidden on small screens.
 */
export default function SectionDots() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const first = SECTIONS.find((s) => visible.get(s.id));
        setCurrent(first ? first.id : null);
      },
      // A thin band across the middle of the viewport.
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Sections" className="section-dots">
      <ul>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-label={s.label}
              aria-current={current === s.id ? "true" : undefined}
              className="section-dot"
            >
              <span className="section-dot-label">{s.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
