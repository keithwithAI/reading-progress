import { App, MarkdownView, Plugin, debounce, Editor, Modal } from "obsidian";
import {
  ReadingTimeSettingsTab,
  ReadingTimeSettings,
  RT_DEFAULT_SETTINGS,
} from "./settings";
import { readingTimeText } from "./helpers";

export default class ReadingProgress extends Plugin {
  settings: ReadingTimeSettings;
  statusBar: HTMLElement;

  async onload() {
    await this.loadSettings();

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("plugin-reading-progress");
    this.statusBar.setText("");

    this.addSettingTab(new ReadingTimeSettingsTab(this.app, this));

    this.addCommand({
      id: "reading-time-editor",
      name: "Selected text",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        new ReadingTimeModal(this.app, editor, this).open();
      },
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", this.calculateReadingTime)
    );
    this.registerEvent(
      this.app.workspace.on("file-open", this.calculateReadingTime)
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.calculateReadingTime)
    );
    this.registerEvent(
      this.app.workspace.on(
        "editor-change",
        debounce(this.calculateReadingTime, 500)
      )
    );

    // Update every half a second - tracks scroll in both edit and reading modes
    let lastScrollTop: number | null = null;
    this.registerInterval(
      window.setInterval(() => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!mdView) return;

        const scrollEl = this.getScrollEl(mdView);
        if (scrollEl) {
          const scrollTop = scrollEl.scrollTop;
          if (lastScrollTop === null || scrollTop !== lastScrollTop) {
            lastScrollTop = scrollTop;
            this.calculateReadingTime();
          }
        }
      }, 500)
    );
  }

  private getScrollEl(mdView: MarkdownView): Element | null {
    const isPreview = mdView.getMode && mdView.getMode() === "preview";
    if (isPreview) {
      return (
        mdView.contentEl.querySelector(".markdown-preview-view") ??
        mdView.contentEl
      );
    }
    return (
      mdView.contentEl.querySelector(".cm-scroller") ??
      mdView.contentEl.querySelector(".markdown-source-view") ??
      mdView.contentEl
    );
  }

  calculateReadingTime = () => {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView) {
      this.statusBar.setText("0 min left");
      return;
    }

    const scrollEl = this.getScrollEl(mdView);
    if (!scrollEl) {
      this.statusBar.setText("0 min left");
      return;
    }

    const scrollTop = scrollEl.scrollTop;
    const scrollHeight = scrollEl.scrollHeight;
    const clientHeight = scrollEl.clientHeight;
    const denom = scrollHeight - clientHeight;
    const progress = denom > 0 ? scrollTop / denom : 0;
    const scrollProgress = Math.min(100, parseFloat((progress * 100).toFixed(1)));

    // getViewData() works in both source and preview modes
    const totalText =
      typeof mdView.getViewData === "function"
        ? mdView.getViewData()
        : mdView.editor
        ? mdView.editor.getValue()
        : "";
    const estimatedReadPosition = Math.floor(totalText.length * progress);
    const textBelowScroll = totalText.slice(estimatedReadPosition);

    const result = readingTimeText(textBelowScroll, this);

    let statusText = `${result}`;
    if (this.settings.showProgressPercentage) {
      statusText += ` (${scrollProgress}%)`;
    }

    this.statusBar.setText(statusText);
  };

  async loadSettings() {
    this.settings = Object.assign(
      {},
      RT_DEFAULT_SETTINGS,
      await this.loadData()
    ) as ReadingTimeSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class ReadingTimeModal extends Modal {
  plugin: ReadingProgress;
  editor: Editor;

  constructor(app: App, editor: Editor, plugin: ReadingProgress) {
    super(app);
    this.editor = editor;
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText("Reading time");
    const stats = readingTimeText(this.editor.getSelection(), this.plugin);
    contentEl.setText(`${stats} (at ${this.plugin.settings.readingSpeed} wpm)`);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
