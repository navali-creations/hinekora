---
"hinekora": patch
---

**Fixed:** Keep editor timelines from saving broken clip layouts.

The editor now normalizes timeline clips before opening, refreshing, and saving projects, and rejects overlapping clip state before it can corrupt playback or exports.

- **Timeline editing:** Clips stay ordered without partial overlaps when gaps are removed, media is refreshed, or older project state is reopened.
- **Editor tests:** Added Playwright coverage for timeline interactions, playback controls, keyboard shortcuts, export actions, and saved edit cleanup flows.
