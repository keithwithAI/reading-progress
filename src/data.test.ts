import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeData } from "./data";

describe("normalizeData", () => {
  it("fills defaults when nothing is stored", () => {
    expect(normalizeData(undefined)).toEqual({ ...DEFAULT_SETTINGS, positions: {} });
    expect(normalizeData(null)).toEqual({ ...DEFAULT_SETTINGS, positions: {} });
  });

  it("has the agreed defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      readingSpeed: 300,
      cjkSpeed: 400,
      showOnMobile: true,
      hideOtherStatusBarItemsOnMobile: true,
      markAsRead: true,
    });
  });

  it("repairs a bad reading speed", () => {
    expect(normalizeData({ readingSpeed: NaN }).readingSpeed).toBe(300);
    expect(normalizeData({ readingSpeed: "abc" }).readingSpeed).toBe(300);
    expect(normalizeData({ readingSpeed: null }).readingSpeed).toBe(300);
  });

  it("clamps speeds to their ranges", () => {
    expect(normalizeData({ readingSpeed: 0 }).readingSpeed).toBe(50);
    expect(normalizeData({ readingSpeed: 1e9 }).readingSpeed).toBe(1500);
    expect(normalizeData({ cjkSpeed: 5000 }).cjkSpeed).toBe(2000);
  });

  it("keeps valid stored values", () => {
    const data = normalizeData({ readingSpeed: 250, cjkSpeed: 500, showOnMobile: false, markAsRead: false });
    expect(data).toMatchObject({ readingSpeed: 250, cjkSpeed: 500, showOnMobile: false, markAsRead: false });
  });

  it("uses the default for a non-boolean toggle", () => {
    expect(normalizeData({ markAsRead: "yes" }).markAsRead).toBe(true);
  });

  it("drops malformed positions", () => {
    const data = normalizeData({
      positions: { "a.md": { line: 1, percent: 10, updatedAt: 5 }, "b.md": { line: "x" }, "c.md": null },
    });
    expect(data.positions).toEqual({ "a.md": { line: 1, percent: 10, updatedAt: 5 } });
  });

  it("drops settings that were removed", () => {
    const keys = Object.keys(normalizeData({ format: "compact", appendText: "left", showProgressPercentage: true }));
    expect(keys).not.toContain("format");
    expect(keys).not.toContain("appendText");
    expect(keys).not.toContain("showProgressPercentage");
  });
});
