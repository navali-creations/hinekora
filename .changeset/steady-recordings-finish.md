---
"hinekora": patch
---

**Fixed:** Recordings no longer remain stuck in **Processing** after capture stops.

Hinekora now keeps replay-buffer activity separate from full recordings and reliably clears recording progress when finalization encounters a problem.

- **Recordings page:** Active sessions are labeled **Recording**, while **Processing** is reserved for the brief saving stage.
- **Immediate library updates:** A finished recording now changes from **Processing** to **Saved** without requiring a page reload.
- **Rewind reliability:** Stopping a rewind buffer no longer creates a phantom recording or an incorrect hours-long duration.
- **Rewind recovery:** Rewind sessions left open by an earlier crash or shutdown are closed automatically the next time Hinekora starts.
- **Automatic recovery:** If a recording cannot finish saving to the library, Hinekora keeps retrying and resumes recovery the next time the app opens.
- **Performance-aware recovery:** Background recovery waits until gameplay and recording activity has ended before doing storage work.
