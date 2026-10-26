import { describe, expect, it } from "vitest";
import {
  isAtEnd,
  isBigJump,
  isScrollable,
  pixelFraction,
  referenceLine,
  sectionLineAt,
  sectionStartLines,
} from "./progress";

describe("pixelFraction", () => {
  it("is 0 when the note doesn't scroll", () => {
    expect(pixelFraction(0, 1000, 1000)).toBe(0);
  });

  it("is the share of the scrollable distance", () => {
    expect(pixelFraction(250, 1500, 500)).toBe(0.25);
  });

  it("clamps overscroll", () => {
    expect(pixelFraction(2000, 1500, 500)).toBe(1);
    expect(pixelFraction(-40, 1500, 500)).toBe(0);
  });
});

describe("isScrollable / isAtEnd", () => {
  it("ignores a few pixels of slack", () => {
    expect(isScrollable(1002, 1000)).toBe(false);
    expect(isScrollable(1100, 1000)).toBe(true);
  });

  it("is at the end within 2 px of the bottom", () => {
    expect(isAtEnd(999, 1500, 500)).toBe(true);
    expect(isAtEnd(990, 1500, 500)).toBe(false);
  });

  it("is never at the end when the note fits on screen", () => {
    expect(isAtEnd(0, 500, 500)).toBe(false);
  });
});

describe("referenceLine", () => {
  it("slides from the top line to the bottom line as you scroll", () => {
    expect(referenceLine(10, 30, 0)).toBe(10);
    expect(referenceLine(10, 30, 0.5)).toBe(20);
    expect(referenceLine(10, 30, 1)).toBe(30);
  });

  it("falls back to the top line without a bottom line", () => {
    expect(referenceLine(10, null, 0.7)).toBe(10);
  });
});

describe("sections", () => {
  it("gives each section's first source line", () => {
    expect(sectionStartLines([3, 1, 5])).toEqual([0, 3, 4]);
  });

  it("finds the source line at a y position inside a section", () => {
    expect(sectionLineAt(4, 5, 100, 200, 200)).toBe(6.5);
    expect(sectionLineAt(4, 5, 100, 200, 50)).toBe(4);
    expect(sectionLineAt(4, 5, 100, 200, 400)).toBe(9);
  });

  it("handles a zero-height section", () => {
    expect(sectionLineAt(4, 5, 100, 0, 100)).toBe(4);
  });
});

describe("isBigJump", () => {
  it("is a jump of more than 1.5 screens with no recent input", () => {
    expect(isBigJump(0, 1600, 1000, false)).toBe(true);
    expect(isBigJump(5000, 0, 1000, false)).toBe(true);
  });

  it("is not a jump when the move is small", () => {
    expect(isBigJump(0, 1400, 1000, false)).toBe(false);
  });

  it("is not a jump when the user is scrolling", () => {
    expect(isBigJump(0, 5000, 1000, true)).toBe(false);
  });
});
