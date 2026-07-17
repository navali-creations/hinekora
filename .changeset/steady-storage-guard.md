---
"hinekora": minor
---

**Added:** Recording storage limits and usage in the app bar.

Hinekora now shows how much space recordings and clips use, enforces the configured storage limit, and makes the storage settings directly accessible from the app bar.

- **App bar:** View combined recording and clip usage with a compact progress bar, then click it to open Data & Storage settings. A warning appears when usage reaches 90% of the limit.
- **Storage limit:** Choose the maximum storage in gigabytes, or set it to 0 for unlimited storage.
- **Automatic cleanup:** When the limit is exceeded, Hinekora removes the oldest recordings and clips to make room for new captures while protecting active recording and rewind files.
- **Cleanup reliability:** Storage maintenance is deferred during performance-sensitive capture work when possible and safely resumes after an interrupted cleanup.
