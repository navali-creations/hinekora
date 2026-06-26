---
"hinekora": patch
---

**Fixed:** Keep overlays steady while editing auras and crop regions.

Hinekora now handles overlay setup focus more carefully, so recording controls and aura overlays stay visible when setup tools briefly take focus from the game.

- **Aura editing:** Unlocking aura editing no longer makes recording controls flash off before crop selection opens.
- **Crop selection:** Closing the grid selector keeps overlays steady while focus returns to the game.
- **Game focus:** Overlay visibility now follows the latest Path of Exile focus events instead of assuming focus from the app window or running process.
