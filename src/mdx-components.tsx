import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import ModeOnly from "@/components/ModeOnly";

/** External links in project write-ups open in a new tab, safely. */
function MdxLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  if (/^https?:\/\//.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />;
  }
  return <a href={href} {...props} />;
}

/** ModeOnly lets write-ups gate sections per pill mode: <ModeOnly modes={["red", "both"]}>. */
const components: MDXComponents = {
  a: MdxLink,
  ModeOnly,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
