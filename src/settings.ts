import { App, PluginSettingTab, Setting } from "obsidian";
import ReadingProgress from "./main";

export enum ReadingTimeFormat {
  Default = "default",
  Compact = "compact",
  Simple = "simple",
  Verbose = "verbose",
  Digital = "digital",
}

export interface ReadingTimeSettings {
  readingSpeed: number;
  format: ReadingTimeFormat;
  appendText: string;
  showProgressPercentage: boolean;
  showOnMobile: boolean;
  hideOtherStatusBarItemsOnMobile: boolean;
}

export const RT_DEFAULT_SETTINGS: ReadingTimeSettings = {
  readingSpeed: 300,
  format: ReadingTimeFormat.Default,
  appendText: "left",
  showProgressPercentage: true,
  showOnMobile: true,
  hideOtherStatusBarItemsOnMobile: true,
};

export class ReadingTimeSettingsTab extends PluginSettingTab {
  plugin: ReadingProgress;

  constructor(app: App, plugin: ReadingProgress) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Reading speed")
      .setDesc("Words per minute used for reading speed (default: 200).")
      .addText((text) => {
        text
          .setPlaceholder("Example: 200")
          .setValue(this.plugin.settings.readingSpeed.toString())
          .onChange(async (value) => {
            this.plugin.settings.readingSpeed = parseInt(value.trim());
            await this.plugin
              .saveSettings()
              .then(this.plugin.calculateReadingTime);
          });
      });

    new Setting(this.containerEl)
      .setName("Format")
      .setDesc("Choose the output format")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(ReadingTimeFormat.Default, "Default (10m)")
          .addOption(ReadingTimeFormat.Compact, "Compact (10 min)")
          .addOption(ReadingTimeFormat.Simple, "Simple (10m 4s)")
          .addOption(
            ReadingTimeFormat.Verbose,
            "Verbose (10 minutes 4 seconds)"
          )
          .addOption(ReadingTimeFormat.Digital, "Colon notation (10:04)")
          .setValue(this.plugin.settings.format)
          .onChange(async (value) => {
            this.plugin.settings.format = value as ReadingTimeFormat;
            await this.plugin
              .saveSettings()
              .then(this.plugin.calculateReadingTime);
          })
      );

    new Setting(this.containerEl)
      .setName("Append text")
      .setDesc("Append 'left' to formatted string.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.appendText)
          .onChange(async (value) => {
            this.plugin.settings.appendText = value.trim();
            await this.plugin
              .saveSettings()
              .then(this.plugin.calculateReadingTime);
          })
      );

    new Setting(this.containerEl)
      .setName("Show reading progress percentage")
      .setDesc("Display percentage of text read")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showProgressPercentage)
          .onChange(async (value) => {
            this.plugin.settings.showProgressPercentage = value;
            await this.plugin
              .saveSettings()
              .then(this.plugin.calculateReadingTime);
          })
      );

    new Setting(this.containerEl)
      .setName("Show on mobile")
      .setDesc(
        "Obsidian hides the status bar on mobile by default. Turn this on to show the reading progress pill at the bottom of the screen."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showOnMobile)
          .onChange(async (value) => {
            this.plugin.settings.showOnMobile = value;
            await this.plugin.saveSettings();
            this.plugin.applyMobileClasses();
          })
      );

    new Setting(this.containerEl)
      .setName("Hide other status bar items on mobile")
      .setDesc(
        "When the mobile pill is visible, hide other status bar items (backlinks, properties, word count, etc.) so only the reading time shows. Has no effect when 'Show on mobile' is off."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideOtherStatusBarItemsOnMobile)
          .onChange(async (value) => {
            this.plugin.settings.hideOtherStatusBarItemsOnMobile = value;
            await this.plugin.saveSettings();
            this.plugin.applyMobileClasses();
          })
      );
  }
}
