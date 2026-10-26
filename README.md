# Note Reading Progress

An Obsidian plugin that shows how much reading time is left in the current note, like this: `7 min left (43%)`. It works in reading view and in edit mode, on desktop and on mobile.

## What it does

The status bar shows the time left and how much you've read. On mobile it appears as a small pill at the bottom right. Under a minute it says `<1 min left`, and at the end of the note it says `Done`.

Only prose counts toward the time. Frontmatter, comments (`%% %%` and `<!-- -->`), link and image URLs, embeds, footnote definitions and code blocks are left out. Progress follows the text on screen rather than the scroll bar, so tall images don't skew it.

Chinese and Japanese are counted by character, at their own speed, because they don't put spaces between words. In a note that mixes English and Chinese, the two parts are added together.

When you open a note you read part of before, a `Resume at 43%` chip appears for a few seconds. Tap it to jump back to that spot. Positions are stored in the plugin's `data.json`, so they sync between devices if your vault does.

After a big jump inside a note, for example following a footnote or a heading link, a `Back` chip returns you to where you were.

When you scroll to the end of a note, the plugin adds `read: 2026-10-26` (today's date) to its properties. If `read` has no property type yet, the plugin sets it to Date. If you've already made `read` a checkbox, it writes `true` instead, so the value always matches the type. It never overwrites a `read` value that's already there, and you can turn it off in settings.

The "Selected text" command shows the reading time of the text you have selected.

## Settings

| Setting | Default |
|---|---|
| Reading speed (words per minute) | 300 |
| Chinese speed (Chinese and Japanese characters per minute) | 400 |
| Show on mobile | On |
| Hide other status bar items on mobile | On |
| Mark as read when finished | On |

## Mobile

Obsidian hides the status bar on mobile. This plugin shows its own item there as a pill, and hides the rest of the status bar unless you turn that setting off. The pill hides when no note is open.

On narrow screens, like a folded iPhone, the pill sits a little higher so it clears Obsidian's navigation bar and the bottom bar of the [Reading Highlighter](https://github.com/keithwithAI/reading-highlighter) plugin. On wide screens, like an unfolded iPhone or an iPad, it sits just above the home indicator. To restyle it, add a CSS snippet that targets `body.reading-progress-mobile-visible.is-mobile .app-container .status-bar`. The status bar item has the class `.plugin-reading-progress`.

## Requirements

Obsidian 1.4.4 or newer.

## Development

```sh
npm install
npm test        # unit tests (vitest)
npm run lint    # ESLint with eslint-plugin-obsidianmd
npm run build   # type check and bundle main.js
```

## Acknowledgements

This plugin is a fork of [Remaining reading time](https://github.com/ununnamed/remaining-reading-time) by [ununnamed](https://github.com/ununnamed), MIT-licensed.

## License

MIT, see `LICENSE`.
