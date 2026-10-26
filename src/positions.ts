/** Saved reading positions per note. No obsidian import. */

export interface SavedPosition {
  /** Top visible source line when saved. */
  line: number;
  percent: number;
  updatedAt: number;
}

export type PositionMap = Record<string, SavedPosition>;

/** Below this, the note was only glanced at. */
export const MIN_SAVE_PERCENT = 5;
/** Keep data.json small: only the most recently read notes. */
export const MAX_POSITIONS = 500;
/** How far from the saved spot you must be before Resume is offered. */
const RESUME_GAP = 5;

export function shouldSave(percent: number, scrollable: boolean): boolean {
  return scrollable && percent >= MIN_SAVE_PERCENT;
}

export function recordPosition(
  map: PositionMap,
  path: string,
  line: number,
  percent: number,
  now: number
): PositionMap {
  const next: PositionMap = { ...map, [path]: { line, percent, updatedAt: now } };
  const keys = Object.keys(next);
  if (keys.length <= MAX_POSITIONS) return next;
  keys
    .sort((a, b) => next[a].updatedAt - next[b].updatedAt)
    .slice(0, keys.length - MAX_POSITIONS)
    .forEach((key) => delete next[key]);
  return next;
}

/** True when `key` is `path` itself or inside the folder `path`. */
const isAtOrUnder = (key: string, path: string): boolean =>
  key === path || key.startsWith(path + "/");

/** True when a note at `path`, or under the folder `path`, has a saved position. */
export function hasPosition(map: PositionMap, path: string): boolean {
  return Object.keys(map).some((key) => isAtOrUnder(key, path));
}

export function renamePosition(map: PositionMap, oldPath: string, newPath: string): PositionMap {
  const next: PositionMap = {};
  for (const [key, pos] of Object.entries(map)) {
    next[isAtOrUnder(key, oldPath) ? newPath + key.slice(oldPath.length) : key] = pos;
  }
  return next;
}

export function deletePosition(map: PositionMap, path: string): PositionMap {
  const next: PositionMap = {};
  for (const [key, pos] of Object.entries(map)) {
    if (!isAtOrUnder(key, path)) next[key] = pos;
  }
  return next;
}

/** Combine two copies of the map (e.g. after iCloud sync); the newer entry wins per note. */
export function mergePositions(local: PositionMap, remote: PositionMap): PositionMap {
  const next: PositionMap = { ...local };
  for (const [key, pos] of Object.entries(remote)) {
    if (!next[key] || pos.updatedAt > next[key].updatedAt) next[key] = pos;
  }
  return next;
}

export function shouldOfferResume(saved: SavedPosition | undefined, currentPercent: number): boolean {
  return saved !== undefined && Math.abs(saved.percent - currentPercent) >= RESUME_GAP;
}

/** Local date as YYYY-MM-DD. */
export function todayStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
