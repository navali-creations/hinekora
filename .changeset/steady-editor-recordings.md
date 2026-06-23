---
"hinekora": patch
---

**Improved:** Editor timeline feedback and recording duration recovery.

The editor is easier to use while trimming, copying, and opening recordings that previously had missing or stale duration details.

- **Editor timeline:** Timeline zoom now expands the working area more naturally, adds clearer ruler detail, and supports Ctrl plus mouse wheel zooming.
- **Copy to clipboard:** The editor now shows Processing, Copied, or Copy failed feedback and pauses editor actions while copying is running.
- **Recording library:** Full recordings can recover duration from MP4 metadata, and changed files no longer keep stale durations when metadata cannot be read.
- **Diagnostics:** Editor export and media probing logs now include clearer checkpoints for troubleshooting packaged builds.
