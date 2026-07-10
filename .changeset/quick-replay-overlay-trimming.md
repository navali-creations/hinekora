---
"hinekora": minor
---

**Added:** Quick edit and mute workflow for manual replays and death clips.

You can now trim and refine clips directly from the replay clip overlay without switching to a separate editor flow, including quick playback trimming and one-click handoff back to the editor.

- **Overlay controls:** Added inline trim controls in the manual replay and death clip overlay to jump, drag, and adjust clip boundaries, then save or continue into the editor with current trim settings.
- **Audio control:** Added a dedicated mute toggle on the overlay so you can review clips silently and quickly while trimming.
- **Mute export behavior:** When muted, overlay copy/save operations export a silent clip. The output file will be rendered without an audio track (including when only mute is enabled with no trim changes).
- **Post-save navigation:** Added an inline “Open in Clips view” action in the save confirmation message after a successful save and suppressed during copy/save processing, to jump directly back into editor for that clip.
- **Preview playback:** Video frames now stay on the browser's native playback path while the elapsed timer and timeline marker refresh smoothly at the clip frame rate.
- **Playback resource handling:** Aura capture is suspended while a clip preview is open and restored when it closes, leaving more GPU capacity for video decoding without interrupting the replay buffer.
- **Clip playback compatibility:** New manual replays and death clips use hardware H.264 at 1920x1080 capped at 60 fps for smoother preview playback. Full run recordings keep their configured encoder, resolution, and frame rate.
