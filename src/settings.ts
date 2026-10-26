import { App, PluginSettingTab, Setting } from "obsidian";
import { CPM_RANGE, DEFAULT_SETTINGS, WPM_RANGE } from "./data";
import { parseSpeed } from "./format";
import type ReadingProgress from "./main";

export class ReadingTimeSettingsTab extends PluginSettingTab {
  plugin: ReadingProgress;

  constructor(app: App, plugin: ReadingProgress) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Reading speed")
      .setDesc(`Words per minute (default: ${DEFAULT_SETTINGS.readingSpeed}).`)
      .addText((text) =>
        text.setValue(String(settings.readingSpeed)).onChange(async (value) => {
          const speed = parseSpeed(value, ...WPM_RANGE);
          if (speed === null) return;
          settings.readingSpeed = speed;
          await this.plugin.saveSettings();
          this.plugin.refresh();
        })
      );

    new Setting(containerEl)
      .setName("Chinese speed")
      .setDesc(`Chinese and Japanese characters per minute (default: ${DEFAULT_SETTINGS.cjkSpeed}).`)
      .addText((text) =>
        text.setValue(String(settings.cjkSpeed)).onChange(async (value) => {
          const speed = parseSpeed(value, ...CPM_RANGE);
          if (speed === null) return;
          settings.cjkSpeed = speed;
          await this.plugin.saveSettings();
          this.plugin.refresh();
        })
      );

    new Setting(containerEl)
      .setName("Show on mobile")
      .setDesc(
        "Obsidian hides the status bar on mobile by default. Turn this on to show the reading progress pill at the bottom of the screen."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.showOnMobile).onChange(async (value) => {
          settings.showOnMobile = value;
          await this.plugin.saveSettings();
          this.plugin.applyBodyClasses();
        })
      );

    new Setting(containerEl)
      .setName("Hide other status bar items on mobile")
      .setDesc(
        "When the mobile pill is visible, hide other status bar items (backlinks, properties, word count, etc.) so only the reading time shows. Has no effect when the mobile pill is off."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.hideOtherStatusBarItemsOnMobile).onChange(async (value) => {
          settings.hideOtherStatusBarItemsOnMobile = value;
          await this.plugin.saveSettings();
          this.plugin.applyBodyClasses();
        })
      );

    new Setting(containerEl)
      .setName("Mark as read when finished")
      .setDesc("Adds read: with today's date to the note's properties when you scroll to the end.")
      .addToggle((toggle) =>
        toggle.setValue(settings.markAsRead).onChange(async (value) => {
          settings.markAsRead = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
