"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";

const ALL_NAV = [
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
] as const;

const NAV = ALL_NAV.filter((item) => item.id !== "experience" || siteConfig.showExperience);

/**
 * Sticky header in the same translucent panel colour as the cards. The pill
 * mode is chosen only in the hero (or by scrolling on, for green), so there is
 * no mode toggle here. Section anchors are in-page on the home page and
 * absolute elsewhere.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="border-accent-dim/40 sticky top-0 z-40 border-b bg-(--panel-bg) backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        {/* On the home page this is an in-page jump: no prefetch, or the router
            fetches and parses the whole home RSC payload again while the page loads. */}
        <Link
          href={onHome ? "#top" : "/"}
          prefetch={onHome ? false : undefined}
          className="text-accent font-bold no-underline hover:underline"
          aria-label="Arpan Mandal, home"
        >
          <span aria-hidden="true">~/arpan</span>
        </Link>
        <div className="flex items-center gap-3 md:gap-6">
          <nav aria-label="Primary" className="flex items-center">
            <button
              type="button"
              className="border-accent-dim/60 text-accent min-h-11 cursor-pointer rounded border px-3 text-sm md:hidden"
              aria-expanded={open}
              aria-controls="site-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : "Menu"}
              <span className="sr-only"> navigation</span>
            </button>
            <ul
              id="site-nav"
              className={`${open ? "flex" : "hidden"} border-accent-dim/40 absolute inset-x-0 top-14 flex-col gap-1 border-b bg-(--panel-bg) px-4 py-3 backdrop-blur-md md:static md:flex md:flex-row md:gap-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none`}
            >
              {NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={onHome ? `#${item.id}` : `/#${item.id}`}
                    onClick={() => setOpen(false)}
                    className="text-ink hover:text-accent block py-2 text-sm no-underline hover:underline md:py-0"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
