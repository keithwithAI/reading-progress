/** Status text and settings input parsing. No obsidian import. */

export interface StatusInput {
  minutesLeft: number;
  percent: number;
  done: boolean;
}

/** "7 min", or "<1 min" when under a minute. */
export function formatMinutes(minutes: number): string {
  return minutes < 1 ? "<1 min" : `${Math.ceil(minutes)} min`;
}

/** "7 min left (43%)", or "Done" at the end of the note. */
export function formatStatus({ minutesLeft, percent, done }: StatusInput): string {
  if (done) return "Done";
  return `${formatMinutes(minutesLeft)} left (${Math.round(percent)}%)`;
}

/** A speed typed into settings, rounded and clamped; null when it isn't a number. */
export function parseSpeed(value: string, min: number, max: number): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.round(n), min), max);
}
