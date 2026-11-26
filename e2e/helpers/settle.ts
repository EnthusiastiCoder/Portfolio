import type { Page } from "@playwright/test";

/** Resolves after n animation frames (two: one to run observers and styles, one to paint). */
export async function frames(page: Page, n = 2): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/**
 * Waits until every element matching `selector` holds still: its box and its
 * computed transform, rotate, scale, translate and opacity are the same for
 * `still` frames in a row (one by default: on this CPU-rendered page a frame
 * can take 200 ms). Replaces a fixed sleep after a scroll or a hover that
 * starts transitions or scroll-driven styles. Gives up quietly after `timeout`
 * ms, so the assertion that follows reports what it sees.
 */
export async function settle(
  page: Page,
  selector: string,
  { still = 1, timeout = 3_000 }: { still?: number; timeout?: number } = {},
): Promise<void> {
  await page.evaluate(
    ([sel, need, max]) =>
      new Promise<void>((done) => {
        const end = performance.now() + max;
        let last = "";
        let same = 0;
        const read = () =>
          [...document.querySelectorAll<HTMLElement>(sel)]
            .map((el) => {
              const cs = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              return [
                cs.transform,
                cs.rotate,
                cs.scale,
                cs.translate,
                cs.opacity,
                r.x.toFixed(1),
                r.y.toFixed(1),
              ].join("|");
            })
            .join(";");
        const tick = () => {
          const now = read();
          same = now === last ? same + 1 : 0;
          last = now;
          if (same >= need || performance.now() > end) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [selector, still, timeout] as const,
  );
}
