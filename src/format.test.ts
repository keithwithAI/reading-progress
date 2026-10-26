import { describe, expect, it } from "vitest";
import { formatMinutes, formatStatus, parseSpeed } from "./format";

describe("formatMinutes", () => {
  it("rounds up to whole minutes", () => {
    expect(formatMinutes(10)).toBe("10 min");
    expect(formatMinutes(9.2)).toBe("10 min");
  });

  it("stays in minutes for long notes", () => {
    expect(formatMinutes(95)).toBe("95 min");
  });

  it("shows <1 min under a minute instead of 0 min", () => {
    expect(formatMinutes(0.5)).toBe("<1 min");
    expect(formatMinutes(0)).toBe("<1 min");
  });
});

describe("formatStatus", () => {
  it("shows time left and a whole percent", () => {
    expect(formatStatus({ minutesLeft: 7, percent: 43.4, done: false })).toBe("7 min left (43%)");
    expect(formatStatus({ minutesLeft: 12, percent: 0, done: false })).toBe("12 min left (0%)");
  });

  it("shows <1 min left near the end", () => {
    expect(formatStatus({ minutesLeft: 0.3, percent: 98.6, done: false })).toBe("<1 min left (99%)");
  });

  it("shows Done at the end", () => {
    expect(formatStatus({ minutesLeft: 0, percent: 100, done: true })).toBe("Done");
  });
});

describe("parseSpeed", () => {
  it("parses and rounds", () => {
    expect(parseSpeed("300", 50, 1500)).toBe(300);
    expect(parseSpeed(" 250.6 ", 50, 1500)).toBe(251);
  });

  it("clamps to the range", () => {
    expect(parseSpeed("20", 50, 1500)).toBe(50);
    expect(parseSpeed("99999", 50, 1500)).toBe(1500);
  });

  it("rejects empty and non-numeric input", () => {
    expect(parseSpeed("", 50, 1500)).toBeNull();
    expect(parseSpeed("abc", 50, 1500)).toBeNull();
    expect(parseSpeed("12abc", 50, 1500)).toBeNull();
  });
});
