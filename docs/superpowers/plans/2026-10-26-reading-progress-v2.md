# Note Reading Progress v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the plugin simple and minimal while making it cheap on battery and accurate about the prose that is left (English and Chinese), and add three small reading features: a resume chip, a Back chip, and mark as read.

**Architecture:** Pure logic (stripping, counting, formatting, progress math, saved-position bookkeeping, settings normalization) lives in modules with no `obsidian` import, tested with vitest. A thin Obsidian layer reads the viewport (public `currentMode.getScroll()` first, guarded internals second), listens to scroll passively with a rAF throttle, and drives the status item/pill and one chip slot.

**Tech Stack:** TypeScript, esbuild, Obsidian API (target 1.4.4+), CodeMirror 6 types (`@codemirror/view`, type-only), vitest 3, ESLint 9 + typescript-eslint 8 + eslint-plugin-obsidianmd 0.3. No runtime dependencies (`pretty-ms` and `reading-time` are removed).

**Spec:** the user's brief (pasted in this session), narrowed by Keith's feature-by-feature answers recorded below. After approval this file is copied to `docs/superpowers/plans/2026-10-26-reading-progress-v2.md` (not committed).

---

## Context

The plugin shows "X min left (NN%)" in the status bar and as a pill on mobile. Today it polls every 500 ms, calls `getViewData()` on every scroll change, and estimates "left" as scroll fraction × raw source length, so frontmatter, URLs, embeds, comments, footnote definitions and tall images distort it. Chinese is counted as chars / (wpm × 5), which is badly wrong. Settings have several small bugs. Keith reads mostly on iPhone and iPad and wants it to feel like Instapaper and Reeder, but **simple and minimal**: few settings, little UI.

## What's in and out (Keith's answers)

In:
- All Part 1 fixes and tooling from the brief.
- **Resume chip:** "Resume at 43%" when reopening a half-read note. Ask only; no auto-resume and no resume setting.
- **Back chip** after a big jump inside a note.
- **Mark as read:** **on by default**, one toggle to turn it off.
- Pill always shows **"7 min left (43%)"**. One format, no format dropdown, no append-text box, no percent toggle.
- Pill stays **bottom-right, raised above Reading Highlighter's bar** on iPhone.
- **Code blocks are excluded** from reading time.
- **Finished notes keep their saved position at 100%.**
- Test in **RH Test Vault**.

Out: progress bar, pill menu (and its commands), display modes, fading while scrolling, time formats and append text.

Final settings list: Reading speed (words/min), Chinese speed (characters/min), Show on mobile, Hide other status bar items on mobile, Mark as read when finished.

## Design decisions (my calls, Keith can veto)

1. **Unread = from a reference line.** `referenceLine = topLine + (bottomLine − topLine) × pixelFraction`. At the top it is the first visible line; at the bottom it reaches the last line, so time left falls smoothly to Done. If the bottom line can't be read, use the top line alone and treat "scrolled to the bottom" as Done.
2. **Top line from the public `view.currentMode.getScroll()`** (a source line in both modes). Task 7 confirms this with `eval` first. Bottom line: edit mode via `editor.cm.lineBlockAtHeight(scroller.getBoundingClientRect().top + clientHeight - cm.documentTop)`; reading mode via guarded `previewMode.renderer.sections` (same guard as RH `previewSections()` in `../reading-highlighter/src/main.ts:1079`), measuring only connected sections.
3. **Percent is time-weighted** (read cost / total cost). Zero readable text → pixel fraction.
4. A note that fits on one screen shows its full time and 0%; it is never saved and never marked read.
5. **Counting:** CJK = Han + Hiragana + Katakana characters at Chinese speed (default **400**/min, range 50–2000). Everything else counts as words (whitespace tokens with a letter or digit) at reading speed (default 300 wpm, range 50–1500). Hangul counts as words. Minutes = words/wpm + cjk/cpm.
6. **Stripped:** frontmatter, `%% %%`, `<!-- -->`, fenced code (``` and ~~~, unclosed runs to end), footnote definitions with indented continuation lines, footnote refs, link URL targets, images and embeds (`![](...)`, `![[...]]`), bare URLs, HTML tags (inner text kept). `[label](url)` keeps `label`; `[[Note|Alias]]` keeps `Alias`; `[[Note#H]]` keeps `Note`. Inline code kept. Indented code blocks not detected. Line count preserved.
7. **Text:** `N min left (P%)` with N = `Math.ceil` minutes (no hours, so `95 min left`), `<1 min left (P%)` under a minute, `Done` at the end. P is an integer. Same text on desktop status bar and mobile pill. The "Selected text" command stays and shows `N min` / `<1 min`.
8. **Settings validation:** empty or non-numeric input is not saved; numbers are rounded and clamped. `normalizeData()` repairs bad stored values and drops the removed keys (`format`, `appendText`, `showProgressPercentage`).
9. **Saved positions** in `data.json` under `positions: { [path]: { line, percent, updatedAt } }`. `line` is the **top visible line**, so resuming restores the same view. Saved on scroll end (1.5 s debounce), on leaving the note, and on unload; disk writes at most every 5 s. Not saved below 5% or for unscrollable notes. Capped at 500 most recent. Folder rename/delete rewrites/drops children. `onExternalSettingsChange()` (optional hook, 1.5.7+) merges positions by `updatedAt` so two iCloud devices don't clobber each other.
10. **Jumps:** reading view uses `view.setEphemeralState({ line })` as Keith asked; edit mode uses `view.currentMode.applyScroll(line)` so the cursor doesn't move.
11. **Resume chip:** on opening a note whose saved percent differs from the current one by ≥5 points. Hides after 10 s, on tap, or once the user scrolls more than one screen.
12. **Back chip:** a "big jump" is a scrollTop change > 1.5 viewport heights between two frames with no touch/wheel/key input in the last 400 ms (catches footnote and heading links, RH panel jumps, and resuming). Shows "Back" for 6 s; tap returns to the pre-jump top line. Suppressed for 500 ms after a mode switch or our own jump back.
13. **One chip slot:** a new chip replaces the current one. Mobile: fixed, right-aligned just above the pill. Desktop: bottom-right above the status bar. 44 px tap height on mobile.
14. **Mark as read:** fires once per note per session when the end is reached by scrolling (user input in the last 400 ms) in a scrollable note. Writes `read: YYYY-MM-DD` (local date) with `app.fileManager.processFrontMatter`, never overwrites an existing value. Property name fixed to `read` (no setting).
15. **Pill visibility:** hidden when no markdown view is active. On mobile with "hide other items" on, the whole capsule hides (body class `reading-progress-no-note`).
16. **Pill placement:** iPhone (`.is-phone`) `bottom: calc(86px + env(safe-area-inset-bottom, 0px))` (RH bar at 30 px + ~44 px tall + 12 px gap), `right: 16px`. iPad: `calc(32px + env(safe-area-inset-bottom, 0px))`. Task 8 measures the RH bar and Obsidian's mobile navbar and adjusts.
17. **minAppVersion 1.4.4** (first with `processFrontMatter`). esbuild target es2018.
18. `src/helpers.ts` is replaced by `src/format.ts` in Task 6 (Russian comments go with it). `main.js` stays tracked as today.

## Global Constraints

- Never touch "Keith's second brain". Every `obsidian` CLI call passes `vault="RH Test Vault"` (the real vault is open at the same time). Vault path: `/private/tmp/claude-501/-Users-keith-Library-Mobile-Documents-com-apple-CloudDocs-keithwithAI-reading-highlighter/b4436c34-edf9-4458-956d-bbc35fa8a1b9/scratchpad/RH Test Vault`. If it has vanished, make a new vault in this session's scratchpad and ask Keith to open it once.
- No commits, no version bump, no push until Keith asks. Tasks stop after verification.
- `npm test`, `npm run lint`, `npm run build` all pass before anything is called done. `main.ts` compiles and lints after every task.
- Pure modules (`text.ts`, `format.ts`, `progress.ts`, `positions.ts`, `data.ts`) never import `obsidian`.
- Internal APIs (`renderer.sections`, `editor.cm`) are type-guarded with a silent fallback.
- Scroll listeners are `{ passive: true }`; no `setInterval`. Timers and frames use `window.setTimeout` / `window.requestAnimationFrame` (obsidianmd `prefer-window-timers`). No direct `el.style.x =` writes.
- Mobile CSS overrides repeat both the plain and the `.is-focused` selector variants, like today's `styles.css`.
- README and other prose go through `humanizer`: no em dashes, plain words. UI strings in sentence case.
- Defaults: reading speed 300, Chinese speed 400, show on mobile on, hide others on, mark as read **on**.

## Review Focus

1. **Reading view virtualization** on a 2,000-line note: no exception, sane status at middle and bottom. Test: Task 7 Step 4 vault check (DOM-only path).
2. **External edits while open** (RH writes `==highlight==` in reading view): index rebuilt from `vault.on("modify")`. Test: Task 7 Step 4.
3. **iCloud double-write:** merge keeps both devices' entries, newer wins per path. Test: Task 5 `mergePositions`.
4. **Reading ↔ edit switch mid-note:** listener moves, no doubled listeners, no false Back chip. Test: Task 7 Step 4 and Task 10 Step 2.
5. **Settings garbage** (`"abc"`, `null`, `0`, `1e9`): never NaN in the pill. Test: Task 6 `normalizeData`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/text.ts` (new, pure) | `stripNonReadable`, `countText`, `buildIndex`, `minutesFor` |
| `src/format.ts` (new, pure) | `formatStatus`, `formatMinutes`, `parseSpeed` |
| `src/progress.ts` (new, pure) | `pixelFraction`, `isScrollable`, `isAtEnd`, `referenceLine`, `sectionStartLines`, `sectionLineAt`, `isBigJump` |
| `src/positions.ts` (new, pure) | saved-position bookkeeping, `todayStamp` |
| `src/data.ts` (new, pure) | `Settings`, `PluginData`, `DEFAULT_SETTINGS`, `normalizeData` |
| `src/viewport.ts` (new) | `getScroller`, `readViewport` |
| `src/chip.ts` (new) | the single chip element |
| `src/settings.ts` | settings tab only |
| `src/main.ts` | wiring |
| `styles.css` | pill and chip |
| tests | `src/*.test.ts` next to each pure module |
| tooling | `eslint.config.mjs`, `version-bump.mjs`, `versions.json`, `.github/workflows/release.yml`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json` |

---

### Task 1: Tooling

**Files:** Create `eslint.config.mjs`, `version-bump.mjs`, `.github/workflows/release.yml` (copies of `../reading-highlighter`'s), `versions.json`. Modify `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`. Delete `MOBILE_VERSION.md`.

- [ ] **Step 1:** `package.json`: remove `reading-time` and (after Task 6) `pretty-ms`; devDeps to RH's versions (`eslint ^9.39.4`, `typescript-eslint ^8.59.4`, `eslint-plugin-obsidianmd ^0.3.0`, `@eslint/js ^9`, `vitest ^3.2.7`, `typescript ^5.9.3`); scripts `test: vitest run`, `lint: eslint src/`, `build: tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`, `version: node version-bump.mjs && git add manifest.json versions.json`. `npm install`.
- [ ] **Step 2:** `eslint.config.mjs`: RH's config plus sentence-case options so "Chinese" passes mid-sentence (check option names in `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/ui/sentenceCaseUtil.js`). `tsconfig.json`: RH's strictness flags, `lib: ["DOM","ES2018"]`, `include: ["src/**/*.ts"]`. esbuild `target: "es2018"`.
- [ ] **Step 3:** `manifest.json` `minAppVersion: "1.4.4"`. `versions.json`: `{"0.1.1":"0.12.17","0.1.2":"0.12.17","0.1.3":"0.12.17"}`. Delete `MOBILE_VERSION.md`.
- [ ] **Step 4:** `npm run lint` (fix what it reports in existing code), `npm run build`, `npx vitest run --passWithNoTests`. Expected: all exit 0.

### Task 2: Readable text and counting (`src/text.ts`)

**Interfaces (produces):**
```ts
export interface Counts { words: number; cjk: number }
export interface Speeds { wpm: number; cpm: number }
export interface TextIndex { lineCount: number; total: Counts; countBefore(line: number): Counts; countFrom(line: number): Counts }
export function stripNonReadable(raw: string): string   // same line count as raw
export function countText(text: string): Counts
export function buildIndex(raw: string): TextIndex       // fractional lines interpolate; out-of-range clamps
export function minutesFor(c: Counts, s: Speeds): number
```

- [ ] **Step 1: Failing tests** in `src/text.test.ts`:
  ```ts
  const lines = (s: string) => s.split("\n").length;
  it("keeps line count", () => { const r = "---\na: 1\n---\nx\n```\ncode\n```\n%%\nc\n%%"; expect(lines(stripNonReadable(r))).toBe(lines(r)); });
  it("drops frontmatter", () => expect(countText(stripNonReadable("---\ntitle: Long words here\n---\nHello"))).toEqual({ words: 1, cjk: 0 }));
  it("drops %% and html comments", () => expect(countText(stripNonReadable("a %%hidden words%% b <!-- also hidden --> c"))).toEqual({ words: 3, cjk: 0 }));
  it("keeps link label, drops url", () => expect(stripNonReadable("[read this](https://example.com/a/b)").trim()).toBe("read this"));
  it("drops images and embeds", () => expect(countText(stripNonReadable("![alt text](pic.png) ![[diagram.png]] ok"))).toEqual({ words: 1, cjk: 0 }));
  it("wikilinks keep alias or target", () => expect(stripNonReadable("[[Note|Alias]] [[Other#Heading]]").replace(/\s+/g, " ").trim()).toBe("Alias Other"));
  it("drops bare urls", () => expect(countText(stripNonReadable("see https://x.io/a?b=c now"))).toEqual({ words: 2, cjk: 0 }));
  it("drops footnote defs and refs", () => expect(countText(stripNonReadable("word[^1]\n\n[^1]: long note text\n    continued here"))).toEqual({ words: 1, cjk: 0 }));
  it("drops fenced code", () => {
    expect(countText(stripNonReadable("a\n```js\nconst x = 1\n```\nb"))).toEqual({ words: 2, cjk: 0 });
    expect(countText(stripNonReadable("a\n~~~\nx y\n~~~"))).toEqual({ words: 1, cjk: 0 });
    expect(countText(stripNonReadable("a\n```\nx y z"))).toEqual({ words: 1, cjk: 0 });
  });
  it("keeps inline code", () => expect(countText(stripNonReadable("run `npm test` now"))).toEqual({ words: 4, cjk: 0 }));
  it("counts english words", () => expect(countText("Hello brave new world")).toEqual({ words: 4, cjk: 0 }));
  it("counts chinese chars", () => expect(countText("我爱读书。")).toEqual({ words: 0, cjk: 4 }));
  it("mixed", () => expect(countText("用 Obsidian 读书")).toEqual({ words: 1, cjk: 3 }));
  it("kana is cjk, hangul is words", () => { expect(countText("ひらがなカタカナ").cjk).toBe(8); expect(countText("안녕 세계")).toEqual({ words: 2, cjk: 0 }); });
  it("ignores punctuation-only tokens", () => expect(countText("## — ... * >")).toEqual({ words: 0, cjk: 0 }));
  it("index interpolates", () => { const i = buildIndex("a b\nc d"); expect(i.countFrom(0.5)).toEqual({ words: 3, cjk: 0 }); expect(i.countBefore(1)).toEqual({ words: 2, cjk: 0 }); });
  it("index clamps", () => { const i = buildIndex("a b\nc d"); expect(i.countFrom(-3)).toEqual(i.total); expect(i.countFrom(99)).toEqual({ words: 0, cjk: 0 }); });
  it("minutes add both parts", () => expect(minutesFor({ words: 300, cjk: 400 }, { wpm: 300, cpm: 400 })).toBe(2));
  ```
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement. Multi-line regions become as many `\n` as they held. Footnote definition = line matching `^\[\^[^\]]+\]:` plus following lines indented 2+ spaces or a tab (blank lines between them included). CJK regex `/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu`, replaced by spaces before tokenizing; a word is a token matching `/[\p{L}\p{N}]/u`.
- [ ] **Step 4:** `npm test` → PASS.

### Task 3: Status text and speed parsing (`src/format.ts`)

**Interfaces (produces):**
```ts
export interface StatusInput { minutesLeft: number; percent: number; done: boolean }
export function formatMinutes(minutes: number): string        // "7 min" | "<1 min"
export function formatStatus(input: StatusInput): string      // "7 min left (43%)" | "<1 min left (98%)" | "Done"
export function parseSpeed(value: string, min: number, max: number): number | null
```
Adds `format.ts` and its test only; existing files untouched.

- [ ] **Step 1: Failing tests** in `src/format.test.ts`:
  ```ts
  formatMinutes(10) === "10 min"; formatMinutes(9.2) === "10 min"; formatMinutes(95) === "95 min"; formatMinutes(0.5) === "<1 min"; formatMinutes(0) === "<1 min"
  formatStatus({ minutesLeft: 7, percent: 43.4, done: false }) === "7 min left (43%)"
  formatStatus({ minutesLeft: 0.3, percent: 98.6, done: false }) === "<1 min left (99%)"
  formatStatus({ minutesLeft: 12, percent: 0, done: false }) === "12 min left (0%)"
  formatStatus({ minutesLeft: 0, percent: 100, done: true }) === "Done"
  parseSpeed("300", 50, 1500) === 300; parseSpeed(" 250.6 ", 50, 1500) === 251
  parseSpeed("20", 50, 1500) === 50; parseSpeed("99999", 50, 1500) === 1500
  parseSpeed("", 50, 1500) === null; parseSpeed("abc", 50, 1500) === null
  ```
- [ ] **Step 2:** FAIL. **Step 3:** implement (`Math.ceil` minutes, `Math.round` percent). **Step 4:** PASS.

### Task 4: Progress math (`src/progress.ts`)

**Interfaces (produces):**
```ts
export function pixelFraction(scrollTop: number, scrollHeight: number, clientHeight: number): number  // 0 when not scrollable, clamped 0..1
export function isScrollable(scrollHeight: number, clientHeight: number): boolean                    // scrollHeight - clientHeight > 4
export function isAtEnd(scrollTop: number, scrollHeight: number, clientHeight: number): boolean       // scrollable and within 2 px of bottom
export function referenceLine(top: number, bottom: number | null, fraction: number): number
export function sectionStartLines(lineCounts: number[]): number[]
export function sectionLineAt(start: number, lines: number, sectionTop: number, sectionHeight: number, y: number): number
export function isBigJump(prevTop: number, nextTop: number, viewportHeight: number, recentInput: boolean): boolean  // |Δ| > 1.5 × viewport and no recent input
```

- [ ] **Step 1: Failing tests** in `src/progress.test.ts`:
  ```ts
  pixelFraction(0, 1000, 1000) === 0; pixelFraction(250, 1500, 500) === 0.25; pixelFraction(2000, 1500, 500) === 1
  isScrollable(1002, 1000) === false; isAtEnd(999, 1500, 500) === true; isAtEnd(990, 1500, 500) === false; isAtEnd(0, 500, 500) === false
  referenceLine(10, 30, 0) === 10; referenceLine(10, 30, 0.5) === 20; referenceLine(10, 30, 1) === 30; referenceLine(10, null, 0.7) === 10
  sectionStartLines([3, 1, 5]) deep-equals [0, 3, 4]
  sectionLineAt(4, 5, 100, 200, 200) === 6.5; sectionLineAt(4, 5, 100, 200, 50) === 4; sectionLineAt(4, 5, 100, 200, 400) === 9; sectionLineAt(4, 5, 100, 0, 100) === 4
  isBigJump(0, 1600, 1000, false) === true; isBigJump(0, 1400, 1000, false) === false; isBigJump(0, 5000, 1000, true) === false; isBigJump(5000, 0, 1000, false) === true
  ```
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.

### Task 5: Saved positions (`src/positions.ts`)

**Interfaces (produces):**
```ts
export interface SavedPosition { line: number; percent: number; updatedAt: number }
export type PositionMap = Record<string, SavedPosition>;
export const MIN_SAVE_PERCENT = 5; export const MAX_POSITIONS = 500;
export function shouldSave(percent: number, scrollable: boolean): boolean
export function recordPosition(map: PositionMap, path: string, line: number, percent: number, now: number): PositionMap  // new object, pruned by updatedAt
export function renamePosition(map: PositionMap, oldPath: string, newPath: string): PositionMap   // exact path or keys under oldPath + "/"
export function deletePosition(map: PositionMap, path: string): PositionMap                       // exact path or folder prefix
export function mergePositions(local: PositionMap, remote: PositionMap): PositionMap              // newer updatedAt wins per path
export function shouldOfferResume(saved: SavedPosition | undefined, currentPercent: number): boolean  // |diff| >= 5
export function todayStamp(d: Date): string                                                        // local YYYY-MM-DD
```

- [ ] **Step 1: Failing tests** in `src/positions.test.ts`:
  ```ts
  shouldSave(4.9, true) === false; shouldSave(5, true) === true; shouldSave(50, false) === false; shouldSave(100, true) === true
  recordPosition({}, "a.md", 12, 43, 1000) deep-equals { "a.md": { line: 12, percent: 43, updatedAt: 1000 } }
  // 501 entries with updatedAt 0..500 → 500 entries, the one with updatedAt 0 gone
  renamePosition({ "a.md": p }, "a.md", "b.md") deep-equals { "b.md": p }
  renamePosition({ "f/a.md": p, "fx.md": q }, "f", "g") deep-equals { "g/a.md": p, "fx.md": q }
  deletePosition({ "f/a.md": p, "f.md": q }, "f") deep-equals { "f.md": q }
  mergePositions({ a: at(1), b: at(5) }, { a: at(3), c: at(2) }) deep-equals { a: at(3), b: at(5), c: at(2) }
  shouldOfferResume(undefined, 0) === false; shouldOfferResume({ line: 50, percent: 43, updatedAt: 1 }, 0) === true
  shouldOfferResume({ line: 50, percent: 43, updatedAt: 1 }, 40) === false; shouldOfferResume({ line: 900, percent: 100, updatedAt: 1 }, 0) === true
  todayStamp(new Date(2026, 9, 5)) === "2026-10-05"
  ```
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.

### Task 6: Settings data, tab, and the swap (`src/data.ts`, `src/settings.ts`, `src/main.ts`)

**Interfaces:**
- Consumes: `parseSpeed`, `formatMinutes` (Task 3); `PositionMap` (Task 5); Task 2 functions.
- Produces:
  ```ts
  export interface Settings { readingSpeed: number; cjkSpeed: number; showOnMobile: boolean; hideOtherStatusBarItemsOnMobile: boolean; markAsRead: boolean }
  export interface PluginData extends Settings { positions: PositionMap }
  export const DEFAULT_SETTINGS: Settings;  // 300, 400, true, true, true
  export const WPM_RANGE: readonly [50, 1500]; export const CPM_RANGE: readonly [50, 2000];
  export function normalizeData(raw: unknown): PluginData
  ```
  Plugin exposes `settings: Settings`, `positions: PositionMap`, `saveSettings(): Promise<void>`, `refresh(): void`, `applyBodyClasses(): void`.

- [ ] **Step 1: Failing tests** in `src/data.test.ts`:
  ```ts
  normalizeData(undefined) deep-equals { ...DEFAULT_SETTINGS, positions: {} }
  normalizeData({ readingSpeed: NaN }).readingSpeed === 300; ({ readingSpeed: "abc" }) → 300; ({ readingSpeed: null }) → 300; ({ readingSpeed: 0 }) → 50; ({ readingSpeed: 1e9 }) → 1500
  normalizeData({ cjkSpeed: 5000 }).cjkSpeed === 2000
  normalizeData({ markAsRead: "yes" }).markAsRead === true   // non-boolean → default
  normalizeData({ positions: { "a.md": { line: 1, percent: 10, updatedAt: 5 }, "b.md": { line: "x" }, "c.md": null } }).positions deep-equals { "a.md": { line: 1, percent: 10, updatedAt: 5 } }
  Object.keys(normalizeData({ format: "compact", appendText: "left", showProgressPercentage: true })) has none of those three keys
  ```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement `normalizeData`. Swap: delete `src/helpers.ts`; `settings.ts` imports from `data.ts`; tab has exactly five settings: "Reading speed" ("Words per minute (default: 300)."), "Chinese speed" ("Chinese and Japanese characters per minute (default: 400)."), both via `parseSpeed` (invalid input leaves the stored value), the two existing mobile toggles, "Mark as read when finished" ("Adds read: with today's date to the note's properties when you scroll to the end."). In `main.ts`: `loadSettings` = `normalizeData(await this.loadData())` split into `settings` and `positions`; `saveSettings` writes `{ ...settings, positions }`; rename `applyMobileClasses` → `applyBodyClasses`, `calculateReadingTime` → `refresh` (still the old body for now, using `buildIndex` + `minutesFor` + `formatStatus` on the source fraction); "Selected text" command shows `formatMinutes(minutesFor(countText(stripNonReadable(sel)), speeds))`. Remove `pretty-ms` from `package.json`.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` PASS.

### Task 7: Scroll tracking without polling (`src/viewport.ts`, `src/main.ts`)

**Interfaces (produces):**
```ts
export interface ViewportState { mode: "source" | "preview"; scroller: HTMLElement; scrollTop: number; scrollHeight: number; clientHeight: number; topLine: number; bottomLine: number | null }
export function getScroller(view: MarkdownView): HTMLElement | null   // preview: .markdown-preview-view; source: .cm-scroller
export function readViewport(view: MarkdownView): ViewportState | null
```
main.ts: `scheduleRefresh(): void` (rAF-coalesced), `current: { path: string; index: TextIndex; viewport: ViewportState | null; percent: number; done: boolean; scrollable: boolean } | null`.

- [ ] **Step 1: Confirm `getScroll()`.** Build, copy `main.js manifest.json styles.css` into `<vault>/.obsidian/plugins/note-reading-progress/`, add test notes under `RP/` (2,000-line English note with headings, footnotes, images, links, code; Chinese note; mixed note; one-screen note), enable the plugin, scroll to a known heading in each mode, then `obsidian vault="RH Test Vault" eval code="const v=app.workspace.getActiveViewOfType(require('obsidian').MarkdownView); [v.getMode(), v.currentMode.getScroll()]"`. Expected: close to the heading's source line in both modes. If not in preview, take `topLine` from `renderer.sections` with `sectionLineAt` at `y = scroller top` and record that here.
- [ ] **Step 2:** Implement `viewport.ts` per decision 2; any failure gives `bottomLine: null`.
- [ ] **Step 3:** Rewrite `main.ts` core: delete the `setInterval`; on `active-leaf-change`, `layout-change` (also catches mode switches by comparing `getMode()`), `file-open`, workspace `resize`: move a single passive `scroll` listener to the current scroller and `refresh()`. Scroll → `scheduleRefresh()` (one pending frame). Rebuild `TextIndex` only on file change, `editor-change` (debounced 500 ms) and `vault.on("modify")` for the active file. `refresh()` computes reference line, counts, minutes, time-weighted percent, `done = isAtEnd(...)`, writes `formatStatus`. No markdown view → hide the item and set `reading-progress-no-note`.
- [ ] **Step 4:** `npm test && npm run lint && npm run build`, copy, `plugin:reload id=note-reading-progress`, `dev:errors` empty. Via `eval`, set scrollTop and dispatch `scroll` at top / middle / bottom in both modes: full time + 0%, about half, "Done". Idle 5 s with `getViewData` wrapped: 0 calls. One-screen note: full time, 0%. No note open: item hidden. Append text to the open note with the CLI: time updates. Switch modes twice: one scroll listener (check via a counter in `eval`).

### Task 8: Mobile pill placement (`styles.css`)

- [ ] **Step 1:** Every rule with plain and `.is-focused` variants: `bottom: calc(32px + env(safe-area-inset-bottom, 0px))`; `.is-phone` override `calc(86px + env(safe-area-inset-bottom, 0px))`; `body.reading-progress-no-note.reading-progress-mobile-hide-others.is-mobile … .status-bar { display: none }`.
- [ ] **Step 2:** Verify: `dev:mobile on`, open the long note in reading view, select text so RH shows its docked toolbar, make a highlight so its undo button shows, `dev:screenshot`. With `eval` compare rects of `.status-bar`, `.reading-highlighter-bottom-bar` and `.mobile-navbar` at 390 px width: no intersection. Adjust 86 px if needed and record the measured values here. `dev:mobile off`, `dev:errors` empty.

### Task 9: Chip, saved positions and resume (`src/chip.ts`, `src/main.ts`, `styles.css`)

**Interfaces:**
- Produces:
  ```ts
  export class Chip { constructor(); show(label: string, onTap: () => void, ms: number): void; hide(): void; destroy(): void }   // one element on document.body
  ```
  main.ts: `jumpToLine(view: MarkdownView, line: number): void` (records the pre-jump top line, sets `suppressJumpUntil`, then decision 10).
- [ ] **Step 1:** Scroll end (1.5 s debounce), leaving a note, `onunload` → `recordPosition(map, path, viewport.topLine, percent, Date.now())` when `shouldSave(percent, scrollable)`. Disk write debounced 5 s. `vault.on("rename")` → `renamePosition`; `vault.on("delete")` → `deletePosition`.
- [ ] **Step 2:** `onExternalSettingsChange()`: `normalizeData(await loadData())`, `positions = mergePositions(positions, remote.positions)`, adopt remote settings, `applyBodyClasses()`, `refresh()`.
- [ ] **Step 3:** On `file-open`: after ~350 ms, `refresh()`; if `shouldOfferResume(saved, percent)` → `chip.show(\`Resume at ${Math.round(saved.percent)}%\`, () => jumpToLine(view, saved.line), 10_000)`; hide once scrolled more than one viewport. Chip CSS: fixed, `right: 16px`; mobile bottom = pill bottom + 40 px (`calc(126px + env(...))` on phone, `calc(72px + env(...))` on tablet), desktop `bottom: 40px`; `min-height: 44px` on mobile; same look as the pill.
- [ ] **Step 4:** Verify in the vault: scroll the long note to about 40%, wait 2 s, open another note, wait 6 s, `data.json` has the entry. Reopen: chip "Resume at 40%"; `.click()` it; status about 40%. Rename the note with the CLI: key moves. Delete a copy: key gone. One-screen note: never saved.

### Task 10: Back chip (`src/main.ts`)

**Interfaces:** Consumes `isBigJump`, `Chip`, `jumpToLine`. Adds `lastInputAt` (passive `touchstart`, `touchmove`, `wheel`, `keydown` on the scroller) and `suppressJumpUntil` (500 ms after attach, mode switch, and our own Back jump).

- [ ] **Step 1:** In the rAF handler compare previous and current `scrollTop`; on `isBigJump(prev, next, clientHeight, now - lastInputAt < 400)` and `now > suppressJumpUntil`, `chip.show("Back", () => jumpToLine(view, preJumpTopLine), 6000)`.
- [ ] **Step 2:** Verify: click a footnote ref and a far `[[#Heading]]` link via `eval` → Back chip; click it → earlier percent. `wheel` then a large scroll → no chip. Tapping Resume → Back chip. Mode switch → no chip.

### Task 11: Mark as read (`src/main.ts`)

- [ ] **Step 1:** In `refresh()`: when `done && settings.markAsRead && scrollable && now - lastInputAt < 400` and the path isn't in `markedThisSession`, add it and `processFrontMatter(file, fm => { if (fm.read == null || fm.read === "") fm.read = todayStamp(new Date()); })`.
- [ ] **Step 2:** Verify: dispatch `wheel`, scroll to the end; `read` property is today's date. A note with `read: 2025-01-01` keeps it. Jumping to the end with a heading link (no input) doesn't mark. Toggle off: nothing written.

### Task 12: Docs and final check

- [ ] **Step 1:** README: what it shows, how time left is counted (prose only, Chinese counted by characters, code excluded), resume and Back chips, mark as read (on by default, how to turn off), the five settings with defaults, mobile placement next to Reading Highlighter, minAppVersion. Run through `humanizer`.
- [ ] **Step 2:** `npm test`, `npm run lint`, `npm run build` all exit 0; `dev:errors` empty; `git status` shows no commits.
- [ ] **Step 3:** Give Keith the device checklist below.

---

## Verification

- Unit: `npm test` (text, format, progress, positions, data).
- Static: `npm run lint`, `npm run build`.
- In RH Test Vault via the Obsidian CLI (always `vault="RH Test Vault"`): `plugin:reload`, `dev:errors`, the `eval` checks per task, `dev:screenshot` desktop and `dev:mobile on`.

## Device checklist for Keith

iPhone:
1. Pill sits above Reading Highlighter's undo button and docked toolbar, clear of the nav bar and home indicator, in portrait and landscape.
2. Half-read a long note on the Mac, open it on the iPhone: "Resume at NN%" appears and lands on the same paragraph.
3. Follow a footnote: "Back" appears and returns you.
4. Read a note to the end: `read:` shows today's date in its properties.
5. Chinese article: time left matches your pace; change Chinese speed if not.

iPad:
6. Pill and chips at the bottom right, clear of Reading Highlighter's bar, including split view.
7. Battery: half an hour of reading, compare Obsidian in Settings > Battery against a normal day.

## Execution

Recommended: **Native** (I do each task test-first in this session, then one fresh reviewer checks the whole diff), because Tasks 7–11 all edit `main.ts` and share its state.

## Implementation notes (2026-10-26)

- Task 7: `currentMode.getScroll()` is the top source line in both modes (reading view 256 for a heading on line 256; edit mode 252.9).
- Task 8: measured at 390x844 in `dev:mobile`: RH bar with docked toolbar is 54px tall (760 to 814), Obsidian's floating nav bar is 760 to 812. Pill moved to `bottom: calc(96px + env(safe-area-inset-bottom))`, 12px above both. iPad (1024 wide): pill x 877 to 1008, RH bar x 379 to 645, no nav bar. Chip sits at 131px (phone) / 67px (tablet).
- Task 11: the "recent input" window for mark as read is 3 s, not 400 ms, because an iOS fling coasts after the finger lifts. Frames that were link jumps are excluded.
- Review fixes: last good position is kept separately (`savable`) so a re-render can't drop it; scrolling back to the top replaces an older spot only after real user input in this note; input clock resets on note change.
