# Reading Progress

An Obsidian plugin that shows the remaining reading time and scroll progress for the current note. Works in **both edit mode and reading mode**, on desktop and mobile.

## Features

- Remaining reading time updates as you scroll
- Works in **reading (preview) mode**, not just edit mode
- Optional progress percentage
- Multiple time formats (compact, simple, verbose, digital, default)
- Configurable reading speed (words per minute)
- Status bar item exposes a `.plugin-reading-progress` CSS class for easy styling
- Mobile-friendly

## Mobile usage

The status bar is hidden by default on Obsidian mobile. To show the reading time pill on iOS/iPadOS/Android, add a CSS snippet via Settings → Appearance → CSS snippets. See `snippets.css` in this repo for an example styled like Note Toolbar's pill.

## Settings

- **Reading speed** — words per minute (default 300)
- **Format** — how time is displayed
- **Append text** — text appended after the time (default "left")
- **Show reading progress percentage** — toggle to append `(NN%)` to the status

## Acknowledgements

This plugin is a fork of [Remaining reading time](https://github.com/ununnamed/remaining-reading-time) by [ununnamed](https://github.com/ununnamed), MIT-licensed. Reading Progress adds reading-mode support, a stable CSS class for the status bar item, and other improvements.

## License

MIT — see `LICENSE`.
