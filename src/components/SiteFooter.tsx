import { siteConfig } from "@/config/site";

/** One sentence split to opposite corners (the FluidMechanics footer trick). */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="split">
        <span className="split-a">Red or blue,</span>{" "}
        <span className="split-b">thanks for scrolling.</span>
      </p>
      <p className="site-footer-legal">{siteConfig.copyright}</p>
    </footer>
  );
}
