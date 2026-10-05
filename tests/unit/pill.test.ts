import { describe, it, expect } from "vitest";
import {
  GLITCH_MS,
  PILLS,
  PILL_EVENT,
  PILL_PARAM,
  PILL_STORAGE_KEY,
  isPill,
  parsePillParam,
  resolveInitialPill,
  withPillParam,
} from "@/lib/pill";

// T1 (WS1): pure pill state helpers.
describe("pill constants", () => {
  it("PILLS lists red, blue and both in that order", () => {
    expect([...PILLS]).toEqual(["red", "blue", "both"]);
  });

  it("exposes the storage key, event name, URL param and glitch duration", () => {
    expect(PILL_STORAGE_KEY).toBe("matrix-pill");
    expect(PILL_EVENT).toBe("matrix-pill");
    expect(PILL_PARAM).toBe("pill");
    expect(GLITCH_MS).toBe(450);
  });
});

describe("isPill", () => {
  it("accepts exactly red, blue and both", () => {
    expect(isPill("red")).toBe(true);
    expect(isPill("blue")).toBe(true);
    expect(isPill("both")).toBe(true);
    for (const v of [
      "RED",
      "Blue",
      "green",
      "",
      " red",
      "full",
      "calm",
      null,
      undefined,
      1,
      {},
      [],
    ]) {
      expect(isPill(v), JSON.stringify(v)).toBe(false);
    }
  });
});

describe("parsePillParam", () => {
  it("parses with and without the leading question mark", () => {
    expect(parsePillParam("?pill=red")).toBe("red");
    expect(parsePillParam("pill=blue")).toBe("blue");
  });

  it("finds the pill among other params", () => {
    expect(parsePillParam("?x=1&pill=both")).toBe("both");
  });

  it("returns null for wrong case, unknown values, empty input and empty value", () => {
    expect(parsePillParam("?pill=RED")).toBeNull();
    expect(parsePillParam("?pill=green")).toBeNull();
    expect(parsePillParam("")).toBeNull();
    expect(parsePillParam("?pill=")).toBeNull();
  });
});

describe("resolveInitialPill", () => {
  it("lets the URL param beat the stored choice", () => {
    expect(resolveInitialPill({ param: "red", stored: "blue" })).toEqual({
      pill: "red",
      chosen: true,
    });
  });

  it("uses the stored choice when there is no param", () => {
    expect(resolveInitialPill({ param: null, stored: "blue" })).toEqual({
      pill: "blue",
      chosen: true,
    });
  });

  it("uses the param alone as a choice", () => {
    expect(resolveInitialPill({ param: "both", stored: null })).toEqual({
      pill: "both",
      chosen: true,
    });
  });

  it("falls back to both, not chosen, when neither exists", () => {
    expect(resolveInitialPill({ param: null, stored: null })).toEqual({
      pill: "both",
      chosen: false,
    });
  });
});

describe("withPillParam", () => {
  it("adds the pill and keeps other params and the hash", () => {
    expect(withPillParam("/?a=1#projects", "red")).toBe("/?a=1&pill=red#projects");
  });

  it("drops the origin and replaces an existing pill", () => {
    expect(withPillParam("https://x.dev/?pill=blue", "both")).toBe("/?pill=both");
  });

  it("never contains two pill= params", () => {
    const inputs = [
      "/",
      "/?pill=red",
      "/?pill=red&pill=blue",
      "https://x.dev/projects/a?b=2&pill=blue#x",
    ];
    for (const href of inputs) {
      for (const p of ["red", "blue", "both"] as const) {
        const out = withPillParam(href, p);
        expect(out.match(/pill=/g), `${href} -> ${out}`).toHaveLength(1);
        expect(out, `${href} -> ${out}`).toContain(`pill=${p}`);
        expect(out.startsWith("/"), `${href} -> ${out}`).toBe(true);
      }
    }
  });
});
