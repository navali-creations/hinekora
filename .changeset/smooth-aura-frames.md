---
"hinekora": patch
---

**Improved:** Make aura overlays feel smoother.

Thanks to the recent aura calculation improvements, custom aura overlays can now move to 60 FPS capture and redraw pacing, so arched and pointer auras should feel less choppy during gameplay.

- **Aura overlay:** Uses 60 FPS capture for smoother live overlay updates.
- **Custom aura shapes:** Arched and pointer aura sampling now redraws at the intended pace without unnecessary fallback work.
