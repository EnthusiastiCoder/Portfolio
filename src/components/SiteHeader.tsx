"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
] as const;

/** Sticky, opaque header. Section anchors are in-page on the home page and absolute elsewhere. */
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
    <header className="border-accent-dim/40 bg-bg sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href={onHome ? "#top" : "/"}
          className="text-accent font-bold no-underline hover:underline"
          aria-label="Arpan Mandal, home"
        >
          <span aria-hidden="true">~/arpan</span>
        </Link>
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
            className={`${open ? "flex" : "hidden"} border-accent-dim/40 bg-bg absolute inset-x-0 top-14 flex-col gap-1 border-b px-4 py-3 md:static md:flex md:flex-row md:gap-6 md:border-0 md:p-0`}
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
    </header>
  );
}
