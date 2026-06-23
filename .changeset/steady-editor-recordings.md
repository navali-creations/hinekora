---
"hinekora": patch
---

**Improved:** Editor timeline feedback and recording duration recovery.

The editor is easier to use while trimming, copying, and opening recordings that previously had missing or stale duration details.

- **Editor timeline:** Recordings now open with extra timeline room, trims keep the source-length rail stable so clips visibly shrink, and Ctrl plus mouse wheel zooming has clearer ruler detail.
- **Copy to clipboard:** The editor now shows Processing, Copied, or Copy failed feedback and pauses editor actions while copying is running.
- **Recording library:** Full recordings can recover duration from MP4 metadata, and changed files no longer keep stale durations when metadata cannot be read.
- **Diagnostics:** Editor export and media probing logs now include clearer checkpoints for troubleshooting packaged builds.
