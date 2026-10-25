import { siteConfig } from "@/config/site";

/** The site footer: the copyright line. */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-legal">{siteConfig.copyright}</p>
    </footer>
  );
}
