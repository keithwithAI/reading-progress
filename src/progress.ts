/** Viewport math. No obsidian import. */

const clamp01 = (n: number): number => Math.min(Math.max(n, 0), 1);

/** Pixels of slack before a note counts as scrollable. */
const SCROLL_SLACK = 4;
/** How close to the bottom counts as the end. */
const END_TOLERANCE = 2;
/** A programmatic scroll longer than this many screens is a jump. */
const JUMP_SCREENS = 1.5;

export function isScrollable(scrollHeight: number, clientHeight: number): boolean {
  return scrollHeight - clientHeight > SCROLL_SLACK;
}

/** Share of the scrollable distance covered, 0..1; 0 when the note fits on screen. */
export function pixelFraction(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  if (!isScrollable(scrollHeight, clientHeight)) return 0;
  return clamp01(scrollTop / (scrollHeight - clientHeight));
}

export function isAtEnd(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
  return (
    isScrollable(scrollHeight, clientHeight) &&
    scrollTop + clientHeight >= scrollHeight - END_TOLERANCE
  );
}

/**
 * The line reading has reached. At the top of the note it's the first
 * visible line; as you near the bottom it slides down to the last visible
 * line, so the last screen counts down instead of jumping to done.
 */
export function referenceLine(top: number, bottom: number | null, fraction: number): number {
  if (bottom === null) return top;
  return top + (bottom - top) * clamp01(fraction);
}

/** First source line of each reading-view section, from their line counts. */
export function sectionStartLines(lineCounts: number[]): number[] {
  const starts: number[] = [];
  let line = 0;
  for (const n of lineCounts) {
    starts.push(line);
    line += n;
  }
  return starts;
}

/** Source line at height `y`, inside a section spanning `lines` lines from `start`. */
export function sectionLineAt(
  start: number,
  lines: number,
  sectionTop: number,
  sectionHeight: number,
  y: number
): number {
  if (sectionHeight <= 0) return start;
  return start + lines * clamp01((y - sectionTop) / sectionHeight);
}

export function isBigJump(
  prevTop: number,
  nextTop: number,
  viewportHeight: number,
  recentInput: boolean
): boolean {
  return !recentInput && Math.abs(nextTop - prevTop) > viewportHeight * JUMP_SCREENS;
}
