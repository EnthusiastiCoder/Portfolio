import { siteConfig } from "@/config/site";

export default function SiteFooter() {
  return (
    <footer className="border-accent-dim/40 bg-bg border-t">
      <div className="text-muted mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:justify-between">
        <p>{siteConfig.copyright}</p>
        <p>
          <span aria-hidden="true">&gt; </span>Built with Next.js. Wake up, Neo.
        </p>
      </div>
    </footer>
  );
}
