# HTML Editor Plus

**English** | [简体中文](README_zh.md)

> A **modified (enhanced) version** of **[HTML Viewer Plus](https://github.com/kuaile1407/html-viewer-plus)** by **lzq**.
> This repository keeps every feature of the original plugin and adds in-place visual editing and table column/row resizing, released under the same **GPL-3.0** license.

## Attribution & License

| Item | Value |
|------|-------|
| Original plugin | HTML Viewer Plus 1.0.1 |
| Original author | **lzq** (GitHub: [kuaile1407](https://github.com/kuaile1407)) |
| Original repository | <https://github.com/kuaile1407/html-viewer-plus> |
| This repository | <https://github.com/shawn11936/html-editor-plus> (plugin ID: `html-editor-plus`) |
| License | GPL-3.0 — full text in [LICENSE](LICENSE), same as the original |
| Modified | 2026-09-29 |

This work is a **modified version of the original**, as required by section 5 of the GNU GPL v3. The modification and its date are stated above. You are free to use, modify and redistribute this plugin, provided that:

1. the original author, original repository and license statements above are preserved;
2. your derivative work is released under **GPL-3.0** as well;
3. you clearly mark the work as modified and give the date.

Copyright of the original work remains with **lzq**; additions in this version are offered under the same license.

## Changes from the original

Code size (`main.js`): 1367 lines upstream → 2603 lines here (diff: +1260 / −23).

### Visual editing

- An **Edit** button in the bottom toolbar toggles an in-place editing mode.
- Edit in place: text; images (replace, resize, delete); insert links and horizontal rules; font size ±1px; bold / italic / underline; text colour with the system eyedropper; left / centre / right alignment; inline code; blockquotes.
- `Cmd/Ctrl + S` serialises the DOM and writes it back to the original `.html`. Before the first save the previous file is backed up to `99·归档驿站/_编辑备份/`.
- Leaving edit mode with unsaved changes opens a native Obsidian dialog offering **Save** / **Cancel**; *Cancel* reloads from disk and reverts every change.
- Bottom toolbar buttons switched from text glyphs to SVG icons; the fullscreen view keeps only *Refresh / Dark toggle / Edit*.
- Manual dark ↔ light toggle that affects only the current file (never written to it); the default mode follows Obsidian's theme when the file opens.

### Table column & row resizing

- In edit mode, hover an **interior** border of a table: the cursor becomes `col-resize` / `row-resize` and the border is highlighted.
- Drag horizontally to change column widths, vertically to change row heights; cell text re-wraps with the width.
- The change is stored as inline `width` / `height` on the cells and persists through the normal save flow.
- The hit zones are injected into the iframe `<head>` only while editing and removed on exit, so **hovering never marks the document as edited**, and no helper CSS is ever written to the file.
- Dragging counts as an edit, so you still get the save prompt on exit.

Known limits:

- Only interior borders respond; the four outer edges of a table are ignored (otherwise the table would be pushed out of its container).
- A row cannot be shrunk below its content height, and a column cannot be narrower than its minimum content width (e.g. a `white-space: nowrap` cell stays as wide as its text).
- Size changes from dragging are not part of the `Cmd+Z` undo stack; use *Cancel* or reopen the file to revert.

### Features inherited from the original (unchanged)

- Embed preview `![[file.html]]`, element targeting `![[file.html#elementId]]`, custom sizing `![[file.html|600x400]]`
- Fullscreen, open in external browser, `Ctrl + wheel` zoom, `Ctrl+F` in-page search
- Dark theme sync (with custom CSS), hot refresh on file change
- MHTML (`.mht` / `.mhtml`) support
- Right-click to copy embed / link syntax, scroll guard

## Installation

This plugin is **not** listed on the Obsidian community market; install it manually or with BRAT.

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from this repository.
2. Create `.obsidian/plugins/html-editor-plus/` in your vault.
3. Copy the three files into that directory.
4. Restart Obsidian, open Settings → Community plugins, and enable **HTML Editor Plus**.

### BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. BRAT settings → **Add Beta Plugin** → enter `shawn11936/html-editor-plus`.
3. Enable the plugin.

## Usage

- **Open an HTML file**: click it in the file explorer, or embed it in a note with `![[xxx.html]]`.
- **Edit**: click *Edit* in the bottom toolbar → change the content → `Cmd/Ctrl + S` to save; `Esc` or the red dot closes the editor and asks what to do with unsaved changes.
- **Resize tables**: in edit mode hover an interior table border, then press and drag.
- **Backups**: every save leaves the previous version in `99·归档驿站/_编辑备份/`.

## Repository contents

| File | Purpose |
|------|---------|
| `main.js` | Plugin logic (modified from the original) |
| `styles.css` | View and editor styles |
| `manifest.json` | Obsidian plugin manifest |
| `LICENSE` | Full GPL-3.0 text — identical to the original, unmodified |
| `README.md` | This file (English) |
| `README_zh.md` | 简体中文文档 |

`debug.log` is a local runtime log; it is excluded by `.gitignore` and never committed.

## Credits

- **HTML Viewer Plus** by **lzq** — <https://github.com/kuaile1407/html-viewer-plus>, the foundation of everything in this repository.
