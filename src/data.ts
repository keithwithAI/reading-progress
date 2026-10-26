/** Settings shape, defaults and load-time repair. No obsidian import. */
import { PositionMap } from "./positions";

export interface Settings {
  /** Words per minute for non-CJK text. */
  readingSpeed: number;
  /** Chinese and Japanese characters per minute. */
  cjkSpeed: number;
  showOnMobile: boolean;
  hideOtherStatusBarItemsOnMobile: boolean;
  /** Add `read: YYYY-MM-DD` to a note's properties when you reach the end. */
  markAsRead: boolean;
}

export interface PluginData extends Settings {
  positions: PositionMap;
}

export const DEFAULT_SETTINGS: Settings = {
  readingSpeed: 300,
  cjkSpeed: 400,
  showOnMobile: true,
  hideOtherStatusBarItemsOnMobile: true,
  markAsRead: true,
};

export const WPM_RANGE = [50, 1500] as const;
export const CPM_RANGE = [50, 2000] as const;

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null;
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function speed(v: unknown, fallback: number, [min, max]: readonly [number, number]): number {
  return isNumber(v) ? Math.min(Math.max(Math.round(v), min), max) : fallback;
}

function flag(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function positions(v: unknown): PositionMap {
  const out: PositionMap = {};
  if (!isRecord(v)) return out;
  for (const [path, pos] of Object.entries(v)) {
    if (isRecord(pos) && isNumber(pos.line) && isNumber(pos.percent) && isNumber(pos.updatedAt)) {
      out[path] = { line: pos.line, percent: pos.percent, updatedAt: pos.updatedAt };
    }
  }
  return out;
}

/** Whatever loadData() returned, as valid plugin data. Unknown and removed keys are dropped. */
export function normalizeData(raw: unknown): PluginData {
  const r: Raw = isRecord(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    readingSpeed: speed(r.readingSpeed, d.readingSpeed, WPM_RANGE),
    cjkSpeed: speed(r.cjkSpeed, d.cjkSpeed, CPM_RANGE),
    showOnMobile: flag(r.showOnMobile, d.showOnMobile),
    hideOtherStatusBarItemsOnMobile: flag(r.hideOtherStatusBarItemsOnMobile, d.hideOtherStatusBarItemsOnMobile),
    markAsRead: flag(r.markAsRead, d.markAsRead),
    positions: positions(r.positions),
  };
}
