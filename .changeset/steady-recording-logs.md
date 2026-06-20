---
"hinekora": patch
---

**Improved:** Make recording startup easier to diagnose.

Hinekora now leaves clearer local diagnostics when rewind recording starts, especially around the native recording steps that can fail before the app has time to show an error.

- **Recording:** Adds more detailed checkpoints while preparing capture sources, encoders, and replay buffering.
- **Installed app:** Keeps packaged app data separate from development data so release builds start from the right local state.
