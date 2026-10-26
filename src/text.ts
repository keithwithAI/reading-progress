/**
 * Readable-text counting. No obsidian import, so it can be unit tested.
 *
 * Everything here works on source lines: stripping blanks out what isn't
 * prose but keeps the line count, so a viewport line maps straight to an
 * index into the counts.
 */

export interface Counts {
  words: number;
  cjk: number;
}

export interface Speeds {
  /** Words per minute for everything that isn't CJK. */
  wpm: number;
  /** CJK characters per minute. */
  cpm: number;
}

export interface TextIndex {
  lineCount: number;
  total: Counts;
  /** Counts above `line`. Fractional lines take that share of the line. */
  countBefore(line: number): Counts;
  /** Counts from `line` to the end. */
  countFrom(line: number): Counts;
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const WORDLIKE = /[\p{L}\p{N}]/u;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const FOOTNOTE_DEF = /^\[\^[^\]]+\]:/;
const INDENTED = /^( {2,}|\t)/;

/** Replace a match with only its newlines, so line numbers don't shift. */
const keepNewlines = (match: string): string => match.replace(/[^\n]/g, "");

/** Blank out whole-line constructs: frontmatter, fenced code, footnote definitions. */
function blankBlocks(lines: string[]): string[] {
  const out = lines.slice();
  let i = 0;

  if (out[0]?.trim() === "---") {
    const end = out.findIndex((l, n) => n > 0 && (l.trim() === "---" || l.trim() === "..."));
    if (end !== -1) {
      for (let n = 0; n <= end; n++) out[n] = "";
      i = end + 1;
    }
  }

  while (i < out.length) {
    const fence = FENCE.exec(out[i]);
    if (fence) {
      const marker = fence[1];
      out[i] = "";
      i++;
      // An unclosed fence runs to the end of the note.
      while (i < out.length) {
        const close = FENCE.exec(out[i]);
        const closes =
          close !== null && close[1][0] === marker[0] && close[1].length >= marker.length &&
          out[i].trim() === close[1];
        out[i] = "";
        i++;
        if (closes) break;
      }
      continue;
    }

    if (FOOTNOTE_DEF.test(out[i])) {
      out[i] = "";
      i++;
      // Continuation lines are indented; blank lines between them belong to it too.
      while (i < out.length) {
        if (INDENTED.test(out[i])) {
          out[i] = "";
          i++;
          continue;
        }
        if (out[i].trim() === "") {
          let next = i;
          while (next < out.length && out[next].trim() === "") next++;
          if (next < out.length && INDENTED.test(out[next])) {
            i = next;
            continue;
          }
        }
        break;
      }
      continue;
    }

    i++;
  }
  return out;
}

/**
 * The note's source with everything that isn't prose removed. Keeps the
 * same number of lines as `raw`.
 */
export function stripNonReadable(raw: string): string {
  return blankBlocks(raw.split("\n"))
    .join("\n")
    .replace(/%%[\s\S]*?%%/g, keepNewlines)
    .replace(/<!--[\s\S]*?-->/g, keepNewlines)
    .replace(/!\[\[[^\]\n]*\]\]/g, "")
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "")
    .replace(/\[\[[^\]|\n]*\|([^\]\n]*)\]\]/g, "$1")
    .replace(/\[\[([^\]#|\n]*)(#[^\]\n]*)?\]\]/g, "$1")
    .replace(/\[\^[^\]\n]+\]/g, "")
    .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, "$1")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "")
    .replace(/<\/?[a-z][^>\n]*>/gi, " ");
}

export function countText(text: string): Counts {
  let cjk = 0;
  const rest = text.replace(CJK, () => {
    cjk++;
    return " ";
  });
  const words = rest.split(/\s+/).filter((token) => WORDLIKE.test(token)).length;
  return { words, cjk };
}

export function buildIndex(raw: string): TextIndex {
  const perLine = stripNonReadable(raw).split("\n").map(countText);
  const lineCount = perLine.length;
  // prefix[i] = counts of lines 0..i-1
  const prefix: Counts[] = [{ words: 0, cjk: 0 }];
  for (const c of perLine) {
    const last = prefix[prefix.length - 1];
    prefix.push({ words: last.words + c.words, cjk: last.cjk + c.cjk });
  }
  const total = prefix[lineCount];

  const countBefore = (line: number): Counts => {
    const clamped = Math.min(Math.max(line, 0), lineCount);
    const whole = Math.floor(clamped);
    const base = prefix[whole];
    if (whole >= lineCount) return { ...base };
    const frac = clamped - whole;
    return {
      words: base.words + perLine[whole].words * frac,
      cjk: base.cjk + perLine[whole].cjk * frac,
    };
  };

  return {
    lineCount,
    total,
    countBefore,
    countFrom(line: number): Counts {
      const before = countBefore(line);
      return { words: total.words - before.words, cjk: total.cjk - before.cjk };
    },
  };
}

export function minutesFor(c: Counts, s: Speeds): number {
  return c.words / s.wpm + c.cjk / s.cpm;
}
