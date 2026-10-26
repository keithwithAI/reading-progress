import { MarkdownView } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { sectionLineAt, sectionStartLines } from "./progress";

/** Where the active note is scrolled to, in pixels and in source lines (0-based). */
export interface ViewportState {
  mode: "source" | "preview";
  scroller: HTMLElement;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** Top visible source line; null when Obsidian doesn't report one. */
  topLine: number | null;
  /** Bottom visible source line; null when it can't be measured. */
  bottomLine: number | null;
}

interface PreviewSection {
  el: HTMLElement;
  lines: number;
}

export function getScroller(view: MarkdownView): HTMLElement | null {
  const selector = view.getMode() === "preview" ? ".markdown-preview-view" : ".cm-scroller";
  return view.contentEl.querySelector<HTMLElement>(selector);
}

/**
 * Reading-view sections in source order (internal API: each has its
 * element and the number of source lines it covers). Null when the
 * shape isn't what we expect.
 */
function previewSections(view: MarkdownView): PreviewSection[] | null {
  const renderer = (view.previewMode as unknown as { renderer?: { sections?: unknown } })?.renderer;
  const sections = renderer?.sections;
  if (!Array.isArray(sections)) return null;
  const valid = sections.every(
    (s: Partial<PreviewSection> | null) =>
      s != null && s.el instanceof HTMLElement && typeof s.lines === "number"
  );
  return valid ? (sections as PreviewSection[]) : null;
}

/** The CodeMirror 6 view behind the editor (internal API), or null. */
function editorView(view: MarkdownView): EditorView | null {
  const cm = (view.editor as unknown as { cm?: Partial<EditorView> }).cm;
  return cm && typeof cm.lineBlockAtHeight === "function" && cm.state ? (cm as EditorView) : null;
}

function sourceBottomLine(view: MarkdownView, scroller: HTMLElement): number | null {
  const cm = editorView(view);
  if (!cm) return null;
  // documentTop is viewport-relative, so this is the viewport bottom in document coordinates.
  const y = scroller.getBoundingClientRect().top + scroller.clientHeight - cm.documentTop;
  const block = cm.lineBlockAtHeight(y);
  const line = cm.state.doc.lineAt(block.from).number - 1;
  const within = block.height > 0 ? Math.min(Math.max((y - block.top) / block.height, 0), 1) : 0;
  return line + within;
}

/**
 * Off-screen reading sections are detached from the DOM, but the one at
 * the bottom of the viewport is always rendered, so only connected
 * sections are measured.
 */
function previewBottomLine(view: MarkdownView, scroller: HTMLElement): number | null {
  const sections = previewSections(view);
  if (!sections) return null;
  const starts = sectionStartLines(sections.map((s) => s.lines));
  const bottom = scroller.getBoundingClientRect().top + scroller.clientHeight;
  for (let i = sections.length - 1; i >= 0; i--) {
    const { el, lines } = sections[i];
    if (!el.isConnected) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top < bottom) return sectionLineAt(starts[i], lines, rect.top, rect.height, bottom);
  }
  return null;
}

export function readViewport(view: MarkdownView): ViewportState | null {
  const scroller = getScroller(view);
  if (!scroller) return null;
  const mode = view.getMode() === "preview" ? "preview" : "source";
  const top = view.currentMode?.getScroll?.();
  let bottomLine: number | null = null;
  try {
    bottomLine =
      mode === "preview" ? previewBottomLine(view, scroller) : sourceBottomLine(view, scroller);
  } catch {
    bottomLine = null;
  }
  return {
    mode,
    scroller,
    scrollTop: scroller.scrollTop,
    scrollHeight: scroller.scrollHeight,
    clientHeight: scroller.clientHeight,
    topLine: typeof top === "number" && Number.isFinite(top) ? top : null,
    bottomLine,
  };
}
