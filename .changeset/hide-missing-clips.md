---
"hinekora": patch
---

**Fixed:** Hide unavailable replay clips from the editor media picker.

Missing or corrupted clip files no longer appear as usable media in the editor, and the Clips page now makes unavailable clips clearly non-playable while still letting you delete the stale entry.

- **Editor My Media:** Death clips and manual replays with missing video files are filtered out before pagination.
- **Clips page:** Missing clips show an unavailable media indicator, cannot be opened or revealed, and keep delete available for cleanup.
