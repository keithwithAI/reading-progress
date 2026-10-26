import { describe, expect, it } from "vitest";
import {
  MAX_POSITIONS,
  PositionMap,
  SavedPosition,
  deletePosition,
  hasPosition,
  mergePositions,
  recordPosition,
  renamePosition,
  shouldOfferResume,
  shouldSave,
  todayStamp,
} from "./positions";

const at = (updatedAt: number): SavedPosition => ({ line: 10, percent: 20, updatedAt });
const p = at(1);
const q = at(2);

describe("shouldSave", () => {
  it("skips notes barely scrolled", () => {
    expect(shouldSave(4.9, true)).toBe(false);
    expect(shouldSave(5, true)).toBe(true);
  });

  it("skips notes that fit on screen", () => {
    expect(shouldSave(50, false)).toBe(false);
  });

  it("keeps finished notes at 100%", () => {
    expect(shouldSave(100, true)).toBe(true);
  });
});

describe("recordPosition", () => {
  it("stores line, percent and time", () => {
    expect(recordPosition({}, "a.md", 12, 43, 1000)).toEqual({
      "a.md": { line: 12, percent: 43, updatedAt: 1000 },
    });
  });

  it("does not change the map it was given", () => {
    const map: PositionMap = {};
    recordPosition(map, "a.md", 1, 10, 1);
    expect(map).toEqual({});
  });

  it("drops the oldest entries past the cap", () => {
    let map: PositionMap = {};
    for (let i = 0; i < MAX_POSITIONS; i++) map[`n${i}.md`] = at(i);
    map = recordPosition(map, "new.md", 1, 10, 9999);
    expect(Object.keys(map)).toHaveLength(MAX_POSITIONS);
    expect(map["n0.md"]).toBeUndefined();
    expect(map["new.md"]).toBeDefined();
  });
});

describe("rename and delete", () => {
  it("moves a renamed note", () => {
    expect(renamePosition({ "a.md": p }, "a.md", "b.md")).toEqual({ "b.md": p });
  });

  it("moves every note under a renamed folder, and nothing else", () => {
    expect(renamePosition({ "f/a.md": p, "fx.md": q }, "f", "g")).toEqual({ "g/a.md": p, "fx.md": q });
  });

  it("drops a deleted note or folder", () => {
    expect(deletePosition({ "f/a.md": p, "f.md": q }, "f")).toEqual({ "f.md": q });
    expect(deletePosition({ "a.md": p, "b.md": q }, "a.md")).toEqual({ "b.md": q });
  });
});

describe("hasPosition", () => {
  it("finds a note or anything under a folder", () => {
    expect(hasPosition({ "f/a.md": p }, "f/a.md")).toBe(true);
    expect(hasPosition({ "f/a.md": p }, "f")).toBe(true);
  });

  it("ignores paths that only share a prefix", () => {
    expect(hasPosition({ "fx.md": p }, "f")).toBe(false);
    expect(hasPosition({}, "a.md")).toBe(false);
  });
});

describe("mergePositions", () => {
  it("keeps both sides and the newer entry per note", () => {
    expect(mergePositions({ a: at(1), b: at(5) }, { a: at(3), c: at(2) })).toEqual({
      a: at(3),
      b: at(5),
      c: at(2),
    });
  });
});

describe("shouldOfferResume", () => {
  it("offers only when there is a saved spot away from here", () => {
    expect(shouldOfferResume(undefined, 0)).toBe(false);
    expect(shouldOfferResume({ line: 50, percent: 43, updatedAt: 1 }, 0)).toBe(true);
    expect(shouldOfferResume({ line: 50, percent: 43, updatedAt: 1 }, 40)).toBe(false);
  });

  it("offers finished notes too", () => {
    expect(shouldOfferResume({ line: 900, percent: 100, updatedAt: 1 }, 0)).toBe(true);
  });
});

describe("todayStamp", () => {
  it("is the local date as YYYY-MM-DD", () => {
    expect(todayStamp(new Date(2026, 9, 5))).toBe("2026-10-05");
  });
});
