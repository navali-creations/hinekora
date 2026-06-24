## 0.1.0

### Minor Changes

- [`05261f2`](https://github.com/navali-creations/hinekora/commit/05261f2bf9e3da0cca4daf94c9f7d8bd6c627f38) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Choose audio input and output devices for recordings.

  Recording settings now include a separate Audio Settings card for selecting microphone input and desktop output audio.

### Patch Changes

- [`ad620ec`](https://github.com/navali-creations/hinekora/commit/ad620ec6639a95e4f42ea52c85a16610789ae497) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Keep exported editor videos inside the preview area when the window is maximized.

  Saved video previews now stay bounded by the available viewer space so the video controls remain reachable in larger window layouts.

- [`ad620ec`](https://github.com/navali-creations/hinekora/commit/ad620ec6639a95e4f42ea52c85a16610789ae497) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Avoid overlapping end labels on the editor timeline ruler.

  Longer recordings now skip cramped final ruler labels when they would collide with the previous time marker.

- [`ad620ec`](https://github.com/navali-creations/hinekora/commit/ad620ec6639a95e4f42ea52c85a16610789ae497) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Open recording edits with the redirected clip already selected.

  Using Edit from a recording detail page now loads the recording onto the editor timeline and shows it in the preview immediately.

- [`ad620ec`](https://github.com/navali-creations/hinekora/commit/ad620ec6639a95e4f42ea52c85a16610789ae497) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Stop recording links from reloading clips after local editor changes.

  After opening a recording in the editor, New edit and deleting the only timeline clip now stay under your control instead of pulling the original recording back onto the timeline.

## 0.0.11

### Patch Changes

- [`59403eb`](https://github.com/navali-creations/hinekora/commit/59403eb12922f2475e735868558b67227bb1fc89) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Editor timeline feedback and recording duration recovery.

  The editor is easier to use while trimming, copying, and opening recordings that previously had missing or stale duration details.

  - **Editor timeline:** Recordings now open with extra timeline room, trims keep the source-length rail stable so clips visibly shrink, playback follows the timeline marker while scrolled, Ctrl plus mouse wheel zooming has clearer ruler detail, rail handles have a small internal edge inset, and the playhead thumb is cleaner without overlapping hover labels.
  - **Copy to clipboard:** The editor now shows Processing, Copied, or Copy failed feedback and pauses editor actions while copying is running.
  - **Recording library:** Full recordings can recover duration from MP4 metadata, and changed files no longer keep stale durations when metadata cannot be read.
  - **Diagnostics:** Editor export and media probing logs now include clearer checkpoints for troubleshooting packaged builds.

## 0.0.10

### Patch Changes

- [`0d6d8d7`](https://github.com/navali-creations/hinekora/commit/0d6d8d78564a91b0aba387f812b81ab64dcb6f4c) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Recorder overlay controls and aura setup.

  The in-game overlay workflow is smoother for recording, rewind clips, aura editing, and capture visibility.

  - **Recorder overlay:** Adds Recording and Rewind tabs, a minimized view, one shared start/stop control, a profile picker, and quick aura actions from inside the game.
  - **Aura editing:** Adds one-click aura source selection from the recorder overlay, clearer locked/unlocked states, selected-aura highlighting, Esc to lock or cancel, Del to remove, and Ctrl+Z/Ctrl+Y undo and redo.
  - **Capture settings:** Adds a Hide overlays from recordings and rewind toggle so Hinekora overlays can stay out of recordings, clips, screenshots, and external capture tools.
  - **Overlay behavior:** Keeps aura editing visible while selecting crop regions, avoids hiding aura overlays when closing replay clips, and starts overlays more reliably when the game is already running.
  - **Guidance and diagnostics:** Updates onboarding beacons for the new controls and makes overlay, focus, and diagnostic logs easier to follow.

## 0.0.9

### Patch Changes

- [`b7ae6a1`](https://github.com/navali-creations/hinekora/commit/b7ae6a1829407289aa47aaae7738a7e7a01d3d5a) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** App icon polish.

  - **App identity:** Refreshed app icons are included across packaged app assets.

## 0.0.8

### Patch Changes

- [`08190dd`](https://github.com/navali-creations/hinekora/commit/08190dd9d450753593c6f8caa5455ca90520a08f) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Aura Manager preview and aura creation flow.

  Hinekora now makes it easier to focus on the aura you are editing while still allowing you to compare all aura placements when needed.

  - **Aura Manager:** The preview focuses on the selected aura by default, with a Show all auras option when you want to see the full overlay layout.
  - **Adding auras:** Add new aura now unlocks the aura overlay automatically when needed, so creating and positioning a new aura takes one fewer step.

## 0.0.7

### Patch Changes

- [`01bb7f4`](https://github.com/navali-creations/hinekora/commit/01bb7f49a94a902573469fa752513632b3edd078) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Recording source detection and editor save reliability.

  Hinekora is more reliable when switching between Path of Exile games, recording native game sources, and saving edited clips.

  - **Recording:** Path of Exile 1 and Path of Exile 2 running states now follow the selected game more reliably, and capture sources refresh after switching games.
  - **Native source:** Game window sources keep the expected native display resolution instead of falling back to the wrong output size.
  - **Overlays:** Recording and clip preview overlays stay available while interacting with their own windows.
  - **Editor:** Saving from More Options now opens the export dialog normally without freezing the app.

## 0.0.6

### Patch Changes

- [`bdbb9d1`](https://github.com/navali-creations/hinekora/commit/bdbb9d122516a51e39bc252bf813f5f20e3776a6) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Interactive onboarding guidance for recording, editor, and aura setup.

  Hinekora now shows contextual beacons that explain the main recording, editor, and aura controls directly inside the app.

  - **Guided recording:** Beacons explain game selection, the recorder overlay, capture mode, Start, capture source, and capture settings.
  - **Editor:** Beacons explain My media, preview source, editor profiles, more options, and timeline shortcuts.
  - **Aura Manager:** Beacons explain profile selection, lock and unlock behavior, adding new auras, and source versus aura position previews.
  - **Help settings:** A new Help area lets you reset or manage onboarding beacons after dismissing them.
  - **Polish:** Page transitions, pulsing beacon rings, and consistent info alerts make the guidance easier to follow.

## 0.0.5

### Patch Changes

- [`83c53c6`](https://github.com/navali-creations/hinekora/commit/83c53c6c9ff9bd64ed381428b507d1d1ddc26368) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Troubleshooting access to Developer Tools.

  Hinekora now makes troubleshooting, release discovery, and navigation a little easier to use.

  - **Troubleshooting:** Adds an Open DevTools action for checking renderer logs and UI state in installed builds.
  - **What's New:** Makes release version chips and contributor badges easier to read in the Hinekora theme.
  - **Navigation:** Refreshes the Dashboard, Recordings, and Editor icons, and moves Editor to the bottom of the sidebar.
  - **Releases:** Points users to the latest Windows installer directly from the README.

## 0.0.4

### Patch Changes

- [`9171579`](https://github.com/navali-creations/hinekora/commit/91715798d485ff46c69540b7a6073f05f4f42cc4) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Rewind recording startup in installed builds.

  Hinekora now starts the packaged recorder from the correct installed runtime files, avoiding a crash when pressing Start in the released app.

## 0.0.3

### Patch Changes

- [`5a4c795`](https://github.com/navali-creations/hinekora/commit/5a4c795c82ff3e3aaf2d06e1edea81eca9d75324) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Easier troubleshooting for recording and startup problems.

  Hinekora now keeps local diagnostics available independently from crash reporting telemetry and adds a Settings section for opening the diagnostic log when something goes wrong.

  - **Settings:** Adds a Troubleshooting tab with an Open log file action.
  - **Recording:** Start and overlay controls now explain why recording actions are unavailable.
  - **Setup:** Makes the setup sidebar fill the full setup card height for a cleaner first-run flow.

## 0.0.2

### Patch Changes

- [`a68b4ca`](https://github.com/navali-creations/hinekora/commit/a68b4caff316210575471d107eb34229268cbbe4) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make recording startup easier to diagnose.

  Hinekora now leaves clearer local diagnostics when rewind recording starts, especially around the native recording steps that can fail before the app has time to show an error.

  - **Recording:** Adds more detailed checkpoints while preparing capture sources, encoders, and replay buffering.
  - **Installed app:** Keeps packaged app data separate from development data so release builds start from the right local state.

## 0.0.1

### Patch Changes

- [`2573a8b`](https://github.com/navali-creations/hinekora/commit/2573a8bfe3ee510e43933db231625c4f10241066) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  Trigger initial release automation.

## 0.0.0

### Patch Changes

- Initial Hinekora prototype with capture preview, replay clips, full-run recordings, crop/mirror overlay tools, and portable state transfer.
