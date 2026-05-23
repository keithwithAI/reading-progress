# Reading Progress

An Obsidian plugin that shows the remaining reading time and scroll progress for the current note. Works in **both edit mode and reading mode**, on desktop and mobile.

## Features

- Remaining reading time updates as you scroll
- Works in **reading (preview) mode**, not just edit mode
- Optional progress percentage
- Multiple time formats (compact, simple, verbose, digital, default)
- Configurable reading speed (words per minute)
- **Mobile-friendly out of the box** — no CSS snippet required. The plugin ships its own `styles.css` and shows a styled pill at the bottom of the screen on mobile.
- Status bar item exposes a `.plugin-reading-progress` CSS class for users who want to style it further.

## Mobile

Obsidian hides the status bar on mobile by default. Reading Progress ships a `styles.css` that makes its own item visible as a pill near the bottom of the screen and (by default) hides the rest of the status bar so the pill stands alone.

Both behaviors are controlled by settings:

- **Show on mobile** — show/hide the pill on mobile. *Default: on.*
- **Hide other status bar items on mobile** — hide other plugins' status bar items while the pill is visible. *Default: on. Turn off if you also want backlinks, properties, word count, etc. to appear on mobile.*

If you want to restyle the pill, add a CSS snippet that targets `body.reading-progress-mobile-visible.is-mobile .app-container .status-bar`. The plugin's defaults can be overridden the standard way.

## Settings

- **Reading speed** — words per minute (default 300)
- **Format** — how time is displayed
- **Append text** — text appended after the time (default "left")
- **Show reading progress percentage** — toggle to append `(NN%)` to the status
- **Show on mobile** — see Mobile section above
- **Hide other status bar items on mobile** — see Mobile section above

## Acknowledgements

This plugin is a fork of [Remaining reading time](https://github.com/ununnamed/remaining-reading-time) by [ununnamed](https://github.com/ununnamed), MIT-licensed. Reading Progress adds reading-mode scroll support, a stable CSS class, in-plugin mobile styling, and other improvements.

## License

MIT — see `LICENSE`.
