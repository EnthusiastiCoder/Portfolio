import ExternalLink from "@/components/ExternalLink";
import SectionHeading from "@/components/SectionHeading";
import { siteConfig } from "@/config/site";

const SOCIALS = [
  { label: "GitHub", href: siteConfig.links.github },
  { label: "LeetCode", href: siteConfig.links.leetcode },
  { label: "LinkedIn", href: siteConfig.links.linkedin },
];

export default function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="panel p-6 sm:p-8">
      <SectionHeading id="contact-title" command="./contact.sh" title="Contact" />
      <p className="max-w-2xl leading-relaxed">
        Open to interesting problems and good teams. The fastest way to reach me is email.
      </p>
      <p className="mt-4">
        <a href={`mailto:${siteConfig.email}`} className="btn break-all">
          {siteConfig.email}
        </a>
      </p>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {SOCIALS.map((social) => (
          <li key={social.label}>
            <ExternalLink href={social.href} className="inline-flex min-h-11 items-center">
              {social.label}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
