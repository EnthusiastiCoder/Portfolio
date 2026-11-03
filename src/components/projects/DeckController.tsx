"use client";

import { useEffect, useRef } from "react";
import { subscribeScroll } from "@/lib/scroll-progress";

/**
 * Keeps the project deck's state in step with the scroll: `data-current` on
 * the card in front (only it takes clicks) and `data-near` on the cards that
 * show more than a peeking edge (only they pay for the frost). Rides the
 * shared scroll listener; no wheel handling. When a keyboard user focuses a control in a card that is not
 * in front, scrolls the page to that card's place in the pinned deck.
 */
export default function DeckController() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const deck = ref.current?.closest<HTMLElement>("[data-deck]");
    const pin = deck?.querySelector<HTMLElement>("[data-deck-pin]");
    if (!deck || !pin) return;
    const cards = Array.from(deck.querySelectorAll<HTMLElement>("[data-deck-card]"));
    const n = cards.length;
    if (n === 0) return;
    let current = -1;
    let state = "";

    const travel = () => Math.max(1, deck.offsetHeight - window.innerHeight);
    const pinned = () => getComputedStyle(pin).position === "sticky";

    const update = () => {
      const p = Math.min(1, Math.max(0, -deck.getBoundingClientRect().top / travel())) * (n - 1);
      const next = Math.min(n - 1, Math.max(0, Math.floor(p + 0.25)));
      // Near: the cards showing more than a peeking edge. A card rises into
      // view over the second half of the segment before its own (from p =
      // i - 0.5) and has peeled off screen at p = i + 1; a little lead keeps
      // the frost on before the move starts.
      const near = cards.map((_, i) => i === next || (p > i - 0.6 && p < i + 1));
      const key = `${next}:${near.map(Number).join("")}`;
      if (key === state) return;
      state = key;
      cards.forEach((card, i) => {
        if (i === next) card.dataset.current = "";
        else delete card.dataset.current;
        if (near[i]) card.dataset.near = "";
        else delete card.dataset.near;
      });
      current = next;
    };

    const onFocus = (event: FocusEvent) => {
      if (!pinned()) return;
      const card = (event.target as Element | null)?.closest<HTMLElement>("[data-deck-card]");
      const i = card ? cards.indexOf(card) : -1;
      if (i < 0 || i === current) return;
      const top = deck.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + (travel() * i) / Math.max(1, n - 1), behavior: "auto" });
      // The scroll is synchronous: bring the card to the front now rather
      // than on the next scroll frame.
      update();
    };

    update();
    const unsubscribe = subscribeScroll(update);
    deck.addEventListener("focusin", onFocus);
    return () => {
      unsubscribe();
      deck.removeEventListener("focusin", onFocus);
    };
  }, []);

  return <span ref={ref} hidden />;
}
