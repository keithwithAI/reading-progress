/** One small tappable chip ("Resume at 43%", "Back"). Showing a new one replaces the old. */
export class Chip {
  private el: HTMLButtonElement;
  private timer: number | null = null;
  private onTap: (() => void) | null = null;
  /** What the visible chip is for, so callers can hide only their own. */
  kind: string | null = null;

  constructor(parent: HTMLElement) {
    this.el = parent.createEl("button", { cls: "reading-progress-chip", attr: { type: "button" } });
    this.el.addEventListener("click", this.handleClick);
  }

  show(kind: string, label: string, onTap: () => void, ms: number): void {
    this.clearTimer();
    this.kind = kind;
    this.onTap = onTap;
    this.el.setText(label);
    this.el.addClass("is-visible");
    this.timer = window.setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    this.clearTimer();
    this.kind = null;
    this.onTap = null;
    this.el.removeClass("is-visible");
  }

  destroy(): void {
    this.hide();
    this.el.removeEventListener("click", this.handleClick);
    this.el.remove();
  }

  private handleClick = (evt: MouseEvent) => {
    evt.preventDefault();
    const onTap = this.onTap;
    this.hide();
    onTap?.();
  };

  private clearTimer(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}
