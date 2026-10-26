import { describe, expect, it } from "vitest";
import { buildIndex, countText, minutesFor, stripNonReadable } from "./text";

const lines = (s: string) => s.split("\n").length;
const count = (raw: string) => countText(stripNonReadable(raw));

describe("stripNonReadable", () => {
  it("keeps the line count so source lines still map", () => {
    const raw = "---\na: 1\n---\nx\n```\ncode\n```\n%%\nc\n%%\n<!--\nhidden\n-->\n[^1]: note\n    more";
    expect(lines(stripNonReadable(raw))).toBe(lines(raw));
  });

  it("drops frontmatter", () => {
    expect(count("---\ntitle: Long words here\n---\nHello")).toEqual({ words: 1, cjk: 0 });
  });

  it("only treats a leading --- block as frontmatter", () => {
    expect(count("Intro\n---\nmore words\n---")).toEqual({ words: 3, cjk: 0 });
  });

  it("drops %% comments and html comments", () => {
    expect(count("a %%hidden words%% b <!-- also hidden --> c")).toEqual({ words: 3, cjk: 0 });
    expect(count("a\n%%\nhidden\nwords\n%%\nb")).toEqual({ words: 2, cjk: 0 });
  });

  it("keeps the link label and drops the url", () => {
    expect(stripNonReadable("[read this](https://example.com/a/b)").trim()).toBe("read this");
  });

  it("drops images and embeds entirely", () => {
    expect(count("![alt text](pic.png) ![[diagram.png]] ok")).toEqual({ words: 1, cjk: 0 });
  });

  it("keeps the wikilink alias, or the note name without the heading", () => {
    expect(stripNonReadable("[[Note|Alias]] [[Other#Heading]]").replace(/\s+/g, " ").trim()).toBe(
      "Alias Other"
    );
  });

  it("drops bare urls", () => {
    expect(count("see https://x.io/a?b=c now")).toEqual({ words: 2, cjk: 0 });
  });

  it("drops footnote definitions with their continuation lines, and footnote refs", () => {
    expect(count("word[^1]\n\n[^1]: long note text\n    continued here")).toEqual({ words: 1, cjk: 0 });
  });

  it("ends a footnote definition at the first unindented line", () => {
    expect(count("[^1]: note text\n\nBack to prose")).toEqual({ words: 3, cjk: 0 });
  });

  it("drops fenced code blocks", () => {
    expect(count("a\n```js\nconst x = 1\n```\nb")).toEqual({ words: 2, cjk: 0 });
    expect(count("a\n~~~\nx y\n~~~")).toEqual({ words: 1, cjk: 0 });
  });

  it("drops an unclosed fence to the end of the note", () => {
    expect(count("a\n```\nx y z")).toEqual({ words: 1, cjk: 0 });
  });

  it("keeps inline code", () => {
    expect(count("run `npm test` now")).toEqual({ words: 4, cjk: 0 });
  });

  it("keeps the text inside html tags", () => {
    expect(count('<span class="x">two words</span>')).toEqual({ words: 2, cjk: 0 });
  });
});

describe("countText", () => {
  it("counts english words", () => {
    expect(countText("Hello brave new world")).toEqual({ words: 4, cjk: 0 });
  });

  it("counts chinese characters, not punctuation", () => {
    expect(countText("我爱读书。")).toEqual({ words: 0, cjk: 4 });
  });

  it("counts mixed chinese and english", () => {
    expect(countText("用 Obsidian 读书")).toEqual({ words: 1, cjk: 3 });
    expect(countText("我在用Obsidian读书")).toEqual({ words: 1, cjk: 5 });
  });

  it("counts kana as cjk and hangul as words", () => {
    expect(countText("ひらがなカタカナ").cjk).toBe(8);
    expect(countText("안녕 세계")).toEqual({ words: 2, cjk: 0 });
  });

  it("ignores punctuation-only tokens", () => {
    expect(countText("## — ... * >")).toEqual({ words: 0, cjk: 0 });
  });
});

describe("buildIndex", () => {
  it("interpolates inside a line", () => {
    const index = buildIndex("a b\nc d");
    expect(index.countFrom(0.5)).toEqual({ words: 3, cjk: 0 });
    expect(index.countBefore(1)).toEqual({ words: 2, cjk: 0 });
  });

  it("clamps out-of-range lines", () => {
    const index = buildIndex("a b\nc d");
    expect(index.countFrom(-3)).toEqual(index.total);
    expect(index.countFrom(99)).toEqual({ words: 0, cjk: 0 });
    expect(index.countBefore(99)).toEqual(index.total);
  });

  it("does not count stripped lines", () => {
    const index = buildIndex("---\ntitle: x y z\n---\none two");
    expect(index.lineCount).toBe(4);
    expect(index.total).toEqual({ words: 2, cjk: 0 });
    expect(index.countFrom(3)).toEqual({ words: 2, cjk: 0 });
  });
});

describe("minutesFor", () => {
  it("adds the word part and the cjk part", () => {
    expect(minutesFor({ words: 300, cjk: 400 }, { wpm: 300, cpm: 400 })).toBe(2);
  });
});
