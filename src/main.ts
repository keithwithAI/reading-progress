import { App, Editor, MarkdownView, Modal, Plugin, TAbstractFile, TFile, debounce } from "obsidian";
import { Chip } from "./chip";
import { DEFAULT_SETTINGS, Settings, normalizeData } from "./data";
import { formatMinutes, formatStatus } from "./format";
import {
  PositionMap,
  deletePosition,
  hasPosition,
  mergePositions,
  readValue,
  recordPosition,
  renamePosition,
  shouldOfferResume,
  shouldSave,
} from "./positions";
import { isAtEnd, isBigJump, isScrollable, pixelFraction, referenceLine } from "./progress";
import { ReadingTimeSettingsTab } from "./settings";
import { Speeds, TextIndex, buildIndex, countText, minutesFor, stripNonReadable } from "./text";
import { ViewportState, getScroller, readViewport } from "./viewport";

const NO_NOTE_CLASS = "reading-progress-no-note";
/** Reading view renders lazily; give a freshly opened note a moment before measuring it. */
const OPEN_SETTLE_MS = 350;
const RESUME_CHIP_MS = 10_000;
const BACK_CHIP_MS = 6000;
/** Scrolling input within this window means the user moved the page, not a link. */
const INPUT_WINDOW_MS = 400;
/** Ignore scroll changes this long after switching note or mode, or after our own jump. */
const JUMP_SUPPRESS_MS = 500;
/**
 * Reaching the end counts as reading to the end if the user scrolled within
 * this window. Longer than INPUT_WINDOW_MS because an iOS fling keeps
 * coasting after the finger lifts.
 */
const READ_INPUT_WINDOW_MS = 3000;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

const READ_PROPERTY = "read";

/** Obsidian's property type registry (internal API). */
interface PropertyTypes {
  getAssignedWidget(name: string): string | null | undefined;
  setType(name: string, type: string): void;
}

interface Current {
  view: MarkdownView;
  path: string;
  viewport: ViewportState;
  percent: number;
  done: boolean;
  scrollable: boolean;
}

export default class ReadingProgress extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  positions: PositionMap = {};
  statusBar: HTMLElement;
  current: Current | null = null;

  /** The body the plugin's classes live on (the main window's). */
  private body: HTMLElement;
  private scroller: HTMLElement | null = null;
  private frame: number | null = null;
  private index: { path: string; index: TextIndex } | null = null;
  private chip: Chip;
  /** scrollTop when the Resume chip appeared; scrolling a screen away hides it. */
  private resumeOfferTop: number | null = null;
  /**
   * The latest position worth saving. Kept apart from `current` because a
   * re-render (e.g. after writing `read:`) can briefly report a note that
   * doesn't scroll.
   */
  private savable: { path: string; line: number; percent: number } | null = null;
  /** Last wheel, touch drag or scroll key on the note. Taps and clicks don't count. */
  private lastInputAt = 0;
  /** Mouse held down on the note, e.g. dragging the scrollbar. */
  private pointerDown = false;
  private suppressJumpUntil = 0;
  private resumeTimer: number | null = null;
  /** Notes marked as read this session, so each is written at most once. */
  private markedRead = new Set<string>();

  async onload() {
    await this.loadSettings();
    this.body = activeDocument.body;

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("plugin-reading-progress");

    this.chip = new Chip(this.body);
    this.applyBodyClasses();
    this.addSettingTab(new ReadingTimeSettingsTab(this.app, this));

    this.addCommand({
      id: "reading-time-editor",
      name: "Selected text",
      editorCallback: (editor: Editor) => {
        new ReadingTimeModal(this.app, editor, this).open();
      },
    });

    const { workspace, vault } = this.app;
    this.registerEvent(workspace.on("active-leaf-change", this.attach));
    this.registerEvent(workspace.on("layout-change", this.attach));
    this.registerEvent(workspace.on("file-open", this.attach));
    this.registerEvent(
      workspace.on("file-open", (file: TFile | null) => {
        this.clearResumeTimer();
        if (!file) return;
        this.resumeTimer = window.setTimeout(() => {
          this.resumeTimer = null;
          this.offerResume(file.path);
        }, OPEN_SETTLE_MS);
      })
    );
    this.registerEvent(workspace.on("resize", this.scheduleRefresh));
    this.registerEvent(workspace.on("editor-change", this.textChanged));
    this.registerEvent(
      vault.on("modify", (file: TAbstractFile) => {
        if (file.path === this.index?.path) this.textChanged();
      })
    );
    this.registerEvent(
      vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        if (!hasPosition(this.positions, oldPath)) return;
        this.positions = renamePosition(this.positions, oldPath, file.path);
        this.persistSoon();
      })
    );
    this.registerEvent(
      vault.on("delete", (file: TAbstractFile) => {
        if (!hasPosition(this.positions, file.path)) return;
        this.positions = deletePosition(this.positions, file.path);
        this.persistSoon();
      })
    );

    workspace.onLayoutReady(this.attach);
  }

  onunload() {
    this.clearResumeTimer();
    this.savePosition();
    this.persistSoon.cancel();
    void this.saveSettings();
    this.chip.destroy();
    this.detachScroller();
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.body.removeClass("reading-progress-mobile-visible", "reading-progress-mobile-hide-others", NO_NOTE_CLASS);
  }

  get speeds(): Speeds {
    return { wpm: this.settings.readingSpeed, cpm: this.settings.cjkSpeed };
  }

  /** Follow the active note's scroller (it changes with the note and the mode), then recompute. */
  attach = () => {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const scroller = view ? getScroller(view) : null;
    if (scroller !== this.scroller) {
      this.detachScroller();
      this.scroller = scroller;
      this.suppressJumpUntil = Date.now() + JUMP_SUPPRESS_MS;
      scroller?.addEventListener("scroll", this.onScroll, { passive: true });
      scroller?.addEventListener("wheel", this.markInput, { passive: true });
      scroller?.addEventListener("touchmove", this.markInput, { passive: true });
      scroller?.addEventListener("keydown", this.onKeyDown, { passive: true });
      scroller?.addEventListener("mousedown", this.onMouseDown, { passive: true });
    }
    this.refresh();
  };

  private detachScroller() {
    this.scroller?.removeEventListener("scroll", this.onScroll);
    this.scroller?.removeEventListener("wheel", this.markInput);
    this.scroller?.removeEventListener("touchmove", this.markInput);
    this.scroller?.removeEventListener("keydown", this.onKeyDown);
    this.scroller?.removeEventListener("mousedown", this.onMouseDown);
    this.scroller = null;
  }

  private onScroll = () => {
    this.scheduleRefresh();
    this.savePositionSoon();
  };

  private markInput = () => {
    this.lastInputAt = Date.now();
  };

  private onKeyDown = (evt: KeyboardEvent) => {
    if (SCROLL_KEYS.has(evt.key)) this.markInput();
  };

  /** Mouse down on the note (maybe on its scrollbar) until released in that same window. */
  private onMouseDown = () => {
    const win = this.scroller?.ownerDocument.defaultView;
    if (!win) return;
    this.pointerDown = true;
    const release = () => {
      this.pointerDown = false;
      win.removeEventListener("mouseup", release);
      win.removeEventListener("blur", release);
    };
    win.addEventListener("mouseup", release);
    win.addEventListener("blur", release);
  };

  /** True if the user scrolled the note themselves within the last `ms`. */
  private userScrolledWithin(ms: number): boolean {
    return this.pointerDown || Date.now() - this.lastInputAt < ms;
  }

  private clearResumeTimer() {
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
  }

  /** At most one refresh per animation frame. */
  scheduleRefresh = () => {
    if (this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      const before = this.current;
      this.refresh();
      const jumped = this.detectJump(before);
      if (!jumped) this.maybeMarkRead();
    });
  };

  /**
   * A big scroll inside the same note that the user didn't drag there
   * (footnote, heading link, Reading Highlighter's panel): offer Back.
   */
  private detectJump(before: Current | null): boolean {
    const after = this.current;
    if (
      !before ||
      !after ||
      before.view !== after.view ||
      before.path !== after.path ||
      before.viewport.mode !== after.viewport.mode ||
      before.viewport.topLine === null ||
      Date.now() < this.suppressJumpUntil
    ) {
      return false;
    }
    const { scrollTop, clientHeight } = after.viewport;
    if (!isBigJump(before.viewport.scrollTop, scrollTop, clientHeight, this.userScrolledWithin(INPUT_WINDOW_MS))) return false;
    const view = after.view;
    const from = before.viewport.topLine;
    this.chip.show("back", "Back", () => this.jumpToLine(view, from, false), BACK_CHIP_MS);
    return true;
  }

  /** Scrolled to the end of a note by hand: add `read: YYYY-MM-DD` once, never overwriting. */
  private maybeMarkRead() {
    const c = this.current;
    const file = c?.view.file;
    if (
      !c ||
      !file ||
      !this.settings.markAsRead ||
      !c.done ||
      !c.scrollable ||
      this.markedRead.has(c.path) ||
      !this.userScrolledWithin(READ_INPUT_WINDOW_MS)
    ) {
      return;
    }
    // Added before writing so a note whose frontmatter can't be parsed isn't retried every frame.
    this.markedRead.add(c.path);
    // Match the type `read` already has in this vault; give it Date if it has none.
    const types = this.propertyTypes();
    const assigned = types?.getAssignedWidget(READ_PROPERTY) ?? null;
    if (types && !assigned) types.setType(READ_PROPERTY, "date");
    const value = readValue(assigned, new Date());
    this.app.fileManager
      .processFrontMatter(file, (fm: Record<string, unknown>) => {
        if (fm[READ_PROPERTY] == null || fm[READ_PROPERTY] === "") fm[READ_PROPERTY] = value;
      })
      .catch((err: unknown) => console.error(`Note Reading Progress: couldn't mark ${c.path} as read`, err));
  }

  /** The note's text changed: rebuild the counts on the next refresh. */
  private textChanged = debounce(
    () => {
      this.index = null;
      this.refresh();
    },
    500,
    true
  );

  private indexFor(view: MarkdownView, path: string): TextIndex {
    if (this.index?.path !== path) this.index = { path, index: buildIndex(view.getViewData()) };
    return this.index.index;
  }

  refresh = () => {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    // Left a note (or closed it): save where we stopped before the state moves on.
    const activePath = view?.file?.path ?? null;
    if (this.savable && this.savable.path !== activePath) {
      this.savePositionSoon.cancel();
      this.savePosition();
    }
    if (this.current && this.current.path !== activePath) {
      if (this.chip.kind) this.chip.hide();
      // Scrolling in the previous note doesn't count as scrolling this one.
      this.lastInputAt = 0;
      this.pointerDown = false;
    }
    const viewport = view?.file ? readViewport(view) : null;
    if (!view?.file || !viewport) {
      this.current = null;
      this.statusBar.hide();
      this.body.addClass(NO_NOTE_CLASS);
      return;
    }

    const path = view.file.path;
    const index = this.indexFor(view, path);
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const fraction = pixelFraction(scrollTop, scrollHeight, clientHeight);
    const top = viewport.topLine ?? fraction * index.lineCount;
    const line = referenceLine(top, viewport.bottomLine, fraction);
    const done = isAtEnd(scrollTop, scrollHeight, clientHeight);

    const total = minutesFor(index.total, this.speeds);
    const minutesLeft = done ? 0 : minutesFor(index.countFrom(line), this.speeds);
    const percent = done ? 100 : total > 0 ? (1 - minutesLeft / total) * 100 : fraction * 100;

    this.current = {
      view,
      path,
      viewport,
      percent,
      done,
      scrollable: isScrollable(scrollHeight, clientHeight),
    };
    // Below the save threshold only counts when the user scrolled back up
    // themselves; just opening a note at the top must not erase its spot.
    const worthSaving =
      shouldSave(percent, this.current.scrollable) ||
      (this.current.scrollable && path in this.positions && this.userScrolledWithin(READ_INPUT_WINDOW_MS));
    if (viewport.topLine !== null && worthSaving) {
      this.savable = { path, line: viewport.topLine, percent };
    }
    this.statusBar.setText(formatStatus({ minutesLeft, percent, done }));
    this.statusBar.show();
    this.body.removeClass(NO_NOTE_CLASS);

    if (
      this.chip.kind === "resume" &&
      this.resumeOfferTop !== null &&
      Math.abs(scrollTop - this.resumeOfferTop) > clientHeight
    ) {
      this.chip.hide();
    }
  };

  /** Remember where the active note is scrolled to (top visible line). */
  private savePosition() {
    const s = this.savable;
    if (!s) return;
    this.positions = recordPosition(this.positions, s.path, s.line, s.percent, Date.now());
    this.savable = null;
    this.persistSoon();
  }

  private savePositionSoon = debounce(() => this.savePosition(), 1500, true);

  /** Write data.json at most every few seconds; iCloud syncs it to other devices. */
  private persistSoon = debounce(() => void this.saveSettings(), 5000, false);

  private offerResume(path: string) {
    this.refresh();
    const c = this.current;
    const saved = this.positions[path];
    if (!c || c.path !== path || !saved || !shouldOfferResume(saved, c.percent)) return;
    const view = c.view;
    this.resumeOfferTop = c.viewport.scrollTop;
    this.chip.show("resume", `Resume at ${Math.round(saved.percent)}%`, () => this.jumpToLine(view, saved.line), RESUME_CHIP_MS);
  }

  /**
   * Scroll `view` so `line` is at the top, then offer a Back chip to where
   * it was. Reading view jumps with setEphemeralState; edit mode scrolls
   * without moving the cursor.
   */
  jumpToLine(view: MarkdownView, line: number, offerBack = true) {
    const from = this.current?.view === view ? this.current.viewport.topLine : null;
    this.suppressJumpUntil = Date.now() + JUMP_SUPPRESS_MS;
    if (view.getMode() === "preview") view.setEphemeralState({ line: Math.floor(line) });
    else view.currentMode.applyScroll(line);
    if (offerBack && from !== null) {
      this.chip.show("back", "Back", () => this.jumpToLine(view, from, false), BACK_CHIP_MS);
    }
  }

  private propertyTypes(): PropertyTypes | null {
    const types = (this.app as unknown as { metadataTypeManager?: Partial<PropertyTypes> })
      .metadataTypeManager;
    return types &&
      typeof types.getAssignedWidget === "function" &&
      typeof types.setType === "function"
      ? (types as PropertyTypes)
      : null;
  }

  /** data.json changed on disk, e.g. synced from another device. */
  async onExternalSettingsChange() {
    const local = this.positions;
    await this.loadSettings();
    this.positions = mergePositions(local, this.positions);
    this.applyBodyClasses();
    this.refresh();
  }

  applyBodyClasses() {
    this.body.toggleClass("reading-progress-mobile-visible", this.settings.showOnMobile);
    this.body.toggleClass(
      "reading-progress-mobile-hide-others",
      this.settings.showOnMobile && this.settings.hideOtherStatusBarItemsOnMobile
    );
  }

  async loadSettings() {
    const { positions, ...settings } = normalizeData(await this.loadData());
    this.settings = settings;
    this.positions = positions;
  }

  async saveSettings() {
    await this.saveData({ ...this.settings, positions: this.positions });
  }
}

class ReadingTimeModal extends Modal {
  constructor(app: App, private editor: Editor, private plugin: ReadingProgress) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Reading time");
    const minutes = minutesFor(countText(stripNonReadable(this.editor.getSelection())), this.plugin.speeds);
    this.contentEl.setText(formatMinutes(minutes));
  }

  onClose() {
    this.contentEl.empty();
  }
}
