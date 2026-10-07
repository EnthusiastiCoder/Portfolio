import type { JSX, ReactNode } from "react";
import type { Pill } from "@/lib/pill";

type ModeOnlyProps = {
  /** The pill modes this content shows in. */
  modes: Pill[];
  as?: "div" | "span" | "li" | "section";
  className?: string;
  children: ReactNode;
};

/**
 * Server-rendered mode variant. Renders `data-show="red both"` and lets
 * globals.css hide it in the other modes, so switching causes no layout shift
 * from JS and the page works without JS (as "both").
 */
export default function ModeOnly({
  modes,
  as: Tag = "div",
  className,
  children,
}: ModeOnlyProps): JSX.Element {
  return (
    <Tag data-show={modes.join(" ")} className={className}>
      {children}
    </Tag>
  );
}
