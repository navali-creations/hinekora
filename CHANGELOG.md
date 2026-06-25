## 0.2.1

### Patch Changes

- [`d9b6d7d`](https://github.com/navali-creations/hinekora/commit/d9b6d7deae511f15cbb5217d02daff427fb59d7b) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Show the correct Path of Exile game as running.

  Hinekora now handles Steam's generic Path of Exile process more carefully, so playing Path of Exile 2 should no longer make Path of Exile 1 appear as the running game.

  - **Game status:** Generic Steam process detection now uses the game window title when available instead of guessing from the selected game.
  - **Game switching:** Re-selecting the current game no longer restarts the Client.txt watcher or refreshes game status unnecessarily.

## 0.2.0

### Minor Changes

- [`9917219`](https://github.com/navali-creations/hinekora/commit/991721998632ab80f43d8463e9df0c0378a26087) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make clip preview actions clearer and faster to use.

  The preview overlay for death clips and manual replays now uses clearer action labels and can send the current clip straight to the editor.

  - **Clip preview:** Open is now Fullscreen, and Folder is now Show in Explorer.
  - **Editor shortcut:** Use Edit from the preview overlay to open the generated death clip or manual replay in the editor.

  There is a planned feature to make trimming in the overlay itself, but for now this feature will suffice.

### Patch Changes

- [`00c652c`](https://github.com/navali-creations/hinekora/commit/00c652cf1fd017b52c1e2590d094f2fd13edc59f) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Keep overlays from appearing over the desktop after waking Windows.

  Hinekora now rechecks the latest game focus state when the system resumes or unlocks, so requested overlays only return when Path of Exile is actually focused.

  - **Aura overlay:** Persistent aura overlays no longer pop back over other apps just because the game process is still running.
  - **System resume:** Overlay restore stays lightweight and uses the existing game focus history instead of launching extra system probes.

- [`d3a7596`](https://github.com/navali-creations/hinekora/commit/d3a759640f8f863020815c8b5035e6e8cad3c558) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Clean up saved editor edits from More Options.

  The editor More Options menu now includes clearer controls for removing saved edits and keeping the saved edit list short.

  - **Editor cleanup:** Delete all saved edits from the editor menu when you want to reset the saved edit list.
  - **Confirmation:** Delete edit and Delete all edits ask for confirmation before removing saved edits.
  - **Auto-prune:** Enable Auto-prune all but last 5 to automatically remove older saved edits while keeping the latest ones available.

- [`c23583b`](https://github.com/navali-creations/hinekora/commit/c23583bf4589897c1fb56c3521ffe49f39763f40) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Prevent `/deaths` from creating death clips.

  Hinekora now ignores the in-game death counter summary and only triggers death clips from actual slain log lines.

- [`0b5e7c5`](https://github.com/navali-creations/hinekora/commit/0b5e7c52b0ebf1a1d325a09a06c90b0ac3c23caa) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make the editor timeline playhead feel smoother during playback.

  The editor timeline now updates the playhead more fluidly while keeping the timeline view steady as playback follows zoomed-in clips.

- [`7df17d5`](https://github.com/navali-creations/hinekora/commit/7df17d547b05877565fe6afa20679e13633059a0) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make capture preview, editor playback, and clip libraries more reliable.

  Hinekora now does less work during startup and keeps preview data lighter, while fixing a few cases where overlays or edited clips could behave unexpectedly.

  - **Live Preview:** Capture sources load faster, thumbnails are loaded only when needed, and cached preview images are kept bounded.
  - **Editor:** Clips with corrected media durations no longer stop playback early or jump back to the start before the real clip end.
  - **Clip libraries:** Replay updates are applied incrementally, and media library sorting has been tuned for smoother browsing.
  - **Aura editing:** The crop selector closes when it loses focus, so grid lines do not linger after leaving the game flow.

- [`b2f9cb7`](https://github.com/navali-creations/hinekora/commit/b2f9cb7153dfad45369cb7dc5cab82a40e90d685) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Keep editor timelines from saving broken clip layouts.

  The editor now normalizes timeline clips before opening, refreshing, and saving projects, and rejects overlapping clip state before it can corrupt playback or exports.

  - **Timeline editing:** Clips stay ordered without partial overlaps when gaps are removed, media is refreshed, or older project state is reopened.
  - **Editor tests:** Added Playwright coverage for timeline interactions, playback controls, keyboard shortcuts, export actions, and saved edit cleanup flows.

## 0.1.2

### Patch Changes

- [`b56e04b`](https://github.com/navali-creations/hinekora/commit/b56e04bb0fd5ac1b5ebfb582db2b9ac245633401) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Align aura overlays correctly on ultrawide displays.

  Aura overlays now keep their expected position when the game is shown on wider screens, instead of being placed too far to the left.

  - **Aura overlay:** Existing 16:9 aura positions are centered correctly on ultrawide captures.
  - **Aura editing:** Moving, resizing, or adding auras keeps the overlay position consistent with the capture size used for setup.

## 0.1.1

### Patch Changes

- [`ffc4851`](https://github.com/navali-creations/hinekora/commit/ffc4851d481a1b616822db214444c20eb1672d5b) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Changed:** Update selectable Path of Exile leagues.

  The game selector now shows the current league choices for each supported Path of Exile game and falls back safely from older saved league selections.

  - **Path of Exile 1:** League choices are now Standard and Mirage.
  - **Path of Exile 2:** League choices are now Standard and Runes of Aldur.

  For now these leagues are hardcoded and act as a temporary solution. Future patch will add support for more leagues with auto-discovery when leagues either start or finish.

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
