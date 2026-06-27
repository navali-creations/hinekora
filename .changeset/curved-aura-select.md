---
"hinekora": minor
---

**Added:** Experimental support for arched aura selections.

Aura overlays can now be created from curved regions, making it possible to track arc-shaped UI elements like energy shield, spirit or rage bands instead of only rectangular areas.

- **Aura Manager:** Added an arched aura flow with point-based curve selection.
- **Aura editing:** Arched auras can be focused from the overlay, resized, mirrored, rotated, thickened, and optionally straightened.
- **Recording overlay:** Added a quick action for creating arched auras while using the overlay controls.

Note: Arched Aura is running at 24 fps, as it's pretty dense on performance. We may try to optimize it in the near future.

The next Minor release will contain Pointer Selection. Idea is to connect `n` amount of pointers to create a straight line. 
This will be helpful to track Ward resource.

Pointer Selection is the last planned aura selection type.
