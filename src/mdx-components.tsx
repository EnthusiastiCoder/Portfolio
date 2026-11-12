import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";

/** External links in project write-ups open in a new tab, safely. */
function MdxLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  if (/^https?:\/\//.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />;
  }
  return <a href={href} {...props} />;
}

const components: MDXComponents = {
  a: MdxLink,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
