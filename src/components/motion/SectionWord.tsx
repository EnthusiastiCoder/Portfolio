/**
 * The word is drawn by a ::before from data-word, so it is not text in the
 * DOM (no contrast check on pure decoration, nothing for find-in-page).
 * An oversized, decorative section word behind a section: aria-hidden,
 * mix-blend-mode difference, drifting at a fifth of the scroll speed
 * (scroll.css). Static under reduced motion and in calm.
 */
export default function SectionWord({
  children,
  align = "left",
}: {
  children: string;
  align?: "left" | "right";
}) {
  return (
    <span
      aria-hidden="true"
      data-word={children}
      className={`section-word section-word--${align}`}
    />
  );
}
