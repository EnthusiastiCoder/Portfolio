import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import { siteConfig } from "@/config/site";

const SOCIALS = [
  { label: "GitHub", key: "github", href: siteConfig.links.github },
  { label: "LeetCode", key: "leetcode", href: siteConfig.links.leetcode },
  { label: "LinkedIn", key: "linkedin", href: siteConfig.links.linkedin },
];

/**
 * RED: a `$ contact` terminal block whose output lines are the real links.
 * BLUE: one big, friendly call to action. BOTH: the two together.
 */
export default function Contact() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="sect sect--contact"
      data-motion="red"
    >
      <SectionWord align="right">Hello</SectionWord>
      <div className="sect-inner">
        <SectionHeading id="contact-title" command="./contact.sh" title="Contact" />

        <ModeOnly modes={["red", "both"]} className="tty">
          <div className="tty-bar" aria-hidden="true">
            contact.sh
          </div>
          <pre className="tty-body" data-enter="top">
            <span className="tty-cmd">$ contact --email</span>
            {"\n"}
            <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
            {"\n\n"}
            <span className="tty-cmd">$ contact --links</span>
            {SOCIALS.map((s) => (
              <span key={s.key}>
                {"\n"}
                {`${s.key.padEnd(9)} `}
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.href.replace(/^https:\/\//, "")}
                </a>
              </span>
            ))}
            {"\n\n"}
            <span className="tty-cmd">$ status</span>
            {"\n"}open to interesting problems and good teams; email is fastest
          </pre>
        </ModeOnly>

        <ModeOnly modes={["blue", "both"]} className="hello">
          <p className="hello-big" data-enter="depth-out">
            Got something people should enjoy using?
          </p>
          <p className="hello-sub" data-enter="bottom" data-stagger="2">
            I am open to interesting problems and good teams. Email is the fastest way to reach me.
          </p>
          <p className="hello-actions" data-enter="bottom" data-stagger="3">
            <a href={`mailto:${siteConfig.email}`} className="cta-primary cta-primary--big">
              Say hello
            </a>
            {SOCIALS.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hello-link"
              >
                {s.label}
              </a>
            ))}
          </p>
        </ModeOnly>
      </div>
    </section>
  );
}
