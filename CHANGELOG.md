## 0.6.1

### Patch Changes

- [`378afa7`](https://github.com/navali-creations/hinekora/commit/378afa749f5c9bea9adc3bc08246b4b1756aa746) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Make profile switching and overlays more reliable after relaunch.

  Capture profiles, aura profiles, and overlay windows now stay in sync more consistently when Hinekora starts while Path of Exile is already running, when switching games, or when changing profiles from the dashboard and recorder overlay.

  - **Capture profiles:** Remembers profile selection more reliably across relaunches and game switches.
  - **Aura overlays:** Keeps aura profile selection aligned with the active game so overlays continue to render after startup and profile changes.
  - **Recorder overlay:** Keeps profile selection and locked settings behavior consistent between the expanded and compact overlay controls.
  - **Dashboard settings:** Prevents stale profile, settings, or game-process updates from overwriting newer choices.

## 0.6.0

### Minor Changes

- [`1ce1576`](https://github.com/navali-creations/hinekora/commit/1ce1576fd45a221cbfdba67a1e327a7e4caf358d) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Capture profiles and automatic recording startup.

  Hinekora can now remember separate capture setups and automatically continue recording or rewind once the selected Path of Exile game is available, making it easier to relaunch the app without rebuilding the same recording setup every time.

  - **Capture profiles:** Save and switch between recording, rewind, capture, audio, game, and live preview source choices without mixing them with aura profiles.
  - **Profile locking:** Lock a capture profile to protect its saved setup, then unlock it when you intentionally want dashboard setting changes to update that profile.
  - **Automatic capture:** Let session recording or rewind start automatically when the selected game is already running, or wait and continue once the game launches.
  - **Profile management:** Manage capture profiles and aura profiles in separate Settings columns, with game-specific profile switching from the dashboard.
  - **Onboarding:** Updates the capture setup guidance to explain capture profiles, source selection, recording modes, and automatic capture behavior.

- [`3bc4b6d`](https://github.com/navali-creations/hinekora/commit/3bc4b6deb6c5c79bea636924ea19d2d7a42646f7) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Saved edits, refreshed aura visuals, recorder overlay controls, and editor workflow improvements.

  Hinekora now has a dedicated Saved Edits library, refreshed aura icons, clearer recorder overlay controls, and a more predictable editor timeline, making it easier to reopen edits, manage source media, discover editor controls, and keep timeline navigation readable while working with many clips.

  - **Saved Edits:** Adds a saved edit page with sorting, paging, league filters, delete and reveal actions, while keeping source recordings and clips intact.
  - **Editor media rail:** Shows saved edits alongside source media, keeps filtering and pagination responsive, and includes edits that use clips from multiple games or leagues in each matching filter.
  - **Editor save flow:** Renames editor Export labels to Save so the editor language matches the saved-edit workflow.
  - **Timeline editing:** Adds a fit timeline control, keeps a short visual tail after the edit, and switches trim handles consistently when clips become too narrow.
  - **Editor toolbar:** Moves undo and redo into the timeline toolbar, adds editor shortcuts, and adds an editor help modal for reviewing available controls.
  - **History:** Keeps the latest 50 meaningful edit steps, labels trim start and trim end actions more clearly, and shows clip names where useful.
  - **Aura icons:** Refreshes aura icons across the app for a clearer and more consistent visual language.
  - **Recording overlay:** Refreshes the expanded and minimized overlay layouts, adds clearer aura controls for edit, default, arc, and pointer auras, and keeps the timer and window controls compact.
  - **Replay wording:** Renames Manual Clips to Manual Replays across the app.
  - **Dashboard and app bar:** Makes the existing recording and rewind dashboard guidance dismissible, lets recording/rewind and group play banners be re-enabled from the Settings help panel, and changes the app bar More Options button into a Help menu.

- [`3dbc156`](https://github.com/navali-creations/hinekora/commit/3dbc156ad042e0427e10b3fe0bf61757f68f2545) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Custom rewind duration and clearer recording settings.

  Hinekora now keeps a longer rewind buffer and lets death clips and manual replays save a custom amount of recent gameplay, while the dashboard settings are split into focused Recording, Rewind, Capture, and Audio tabs.

  - **Rewind settings:** Choose a preset or custom duration up to 60 seconds for death clips and manual replays.
  - **Recording settings:** Control overlay hiding separately for full-session recordings and rewind clips.
  - **Audio settings:** Loads audio devices with a visible loading and refresh state so opening the Audio tab feels smoother.
  - **Local settings:** Adds a dismissible reminder that recorder settings are saved locally, with a Help settings control to show it again.
  - **Manual Replays:** Moves existing Manual Clips storage into Manual Replays and keeps saved replay paths aligned when possible.

### Patch Changes

- [`868c7b1`](https://github.com/navali-creations/hinekora/commit/868c7b1795e48559e2e42155c7e9c20bcdb86706) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Make editor loading, trimming, and project saves steadier.

  The editor now avoids repeated media loads while opening edits, keeps the timeline ruler stable during trim adjustments, and saves timeline changes after the edit is committed instead of during every drag movement.

  - **Editor loading:** Opening the editor or a saved edit waits for the route and local settings before refreshing My Media, reducing duplicate media loads.
  - **Timeline trimming:** The time ruler no longer shrinks under the cursor while trimming the end of the last clip.
  - **Project saves:** Timeline edits, undo/redo, and project renames are saved in a safer order so local edits are not overwritten by stale save responses.

- [`031708b`](https://github.com/navali-creations/hinekora/commit/031708bd2337e800ab407ea5943a8d1a968226e0) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make aura overlays feel smoother.

  Thanks to the recent aura calculation improvements, custom aura overlays can now move to 60 FPS capture and redraw pacing, so arched and pointer auras should feel less choppy during gameplay.

  - **Aura overlay:** Uses 60 FPS capture for smoother live overlay updates.
  - **Custom aura shapes:** Arched and pointer aura sampling now redraws at the intended pace without unnecessary fallback work.

## 0.5.0

### Minor Changes

- [`8396ca9`](https://github.com/navali-creations/hinekora/commit/8396ca9f83a0dc2665e7e06372ee1717308d3ecc) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Group play death clip filtering.

  Hinekora can now use an optional character name to keep death clips focused on your own deaths when playing in a party.

  - **Dashboard:** Shows a dismissible group play reminder with a shortcut to Game Settings when character names are missing.
  - **Game Settings:** Adds separate Path of Exile 1 and Path of Exile 2 character fields, with help text explaining they are mainly for group play.
  - **Death clips:** When a character name is set, teammate death lines in Client.txt are ignored, and character-name-only updates are not tracked by usage analytics.

- [`bbc3833`](https://github.com/navali-creations/hinekora/commit/bbc383392b48b9ab2a5806b9f1a7dd819f91d46f) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Pointer aura selection.

  Hinekora can now create aura overlays from connected points, making it possible to track narrow or angled UI elements that do not fit a rectangular or arched selection.

  - **Aura Manager and recording overlay:** Added an “Add pointer aura” flow for selecting up to six connected points on the screen.
  - **Aura editing:** Pointer auras can be resized, mirrored, rotated, thickened, and spaced from the properties panel.
  - **Selection polish:** Pointer and arched selections now show clearer guides and boundaries while choosing or editing aura regions.

### Patch Changes

- [`6402304`](https://github.com/navali-creations/hinekora/commit/64023044df6fb754d3752c5e65e4925b83ebec62) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Clarify aura editing controls.

  Aura editing and grid selection now keep the main exit shortcut visible while moving detailed guidance into the overlay controls panel, so it is clearer how to leave editing mode and what each aura selection type does.

  - **Aura overlay:** Shows a persistent Esc hint while aura editing is unlocked and keeps disabled actions visually consistent while selecting a new aura.
  - **Grid selector:** Shows the same Esc hint while choosing a region and keeps the helper panel focused on selection controls.
  - **Controls help:** Adds clearer in-overlay reference panels for aura editing and grid selection without covering selected aura controls.

- [`6402304`](https://github.com/navali-creations/hinekora/commit/64023044df6fb754d3752c5e65e4925b83ebec62) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Update Attributions page links.

  Attribution credits now stay aligned with the README.

  - **Attributions:** Shows the README credit list in the app.

- [`6402304`](https://github.com/navali-creations/hinekora/commit/64023044df6fb754d3752c5e65e4925b83ebec62) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Make editor exports and clipboard copies more reliable.

  Editor exports and copied clips now use the installed app's bundled media tools correctly, and recordings use the actual MP4 length when building the editor timeline.

  - **Editor:** Save and Copy to clipboard should no longer fail because the bundled media tool could not be launched from the installed app.
  - **Recording library:** Recordings with fractional-second lengths now keep their precise duration instead of being rounded to the nearest second.

- [`bbc3833`](https://github.com/navali-creations/hinekora/commit/bbc383392b48b9ab2a5806b9f1a7dd819f91d46f) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make custom aura shapes smoother and safer.

  Pointer and arched auras now handle narrow selections and saved crop data more reliably, especially when editing or dragging overlays.

  - **Aura performance:** Pointer auras and straightened arched auras use bounded video sampling so small shapes stay responsive.

## 0.4.1

### Patch Changes

- [`c756923`](https://github.com/navali-creations/hinekora/commit/c75692398d4bdff7057225a66affd50993b7b472) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Show images in What’s New release notes.

  GitHub release images now render inside the What’s New modal instead of appearing as raw image markup.

## 0.4.0

### Minor Changes

- [`edbc945`](https://github.com/navali-creations/hinekora/commit/edbc9457ba598ee65d56774c5e6f2e9f8877e739) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Experimental support for arched aura selections.

  Aura overlays can now be created from curved regions, making it possible to track arc-shaped UI elements like energy shield, spirit or rage bands instead of only rectangular areas.

  - **Aura Manager:** Added an arched aura flow with point-based curve selection.
  - **Aura editing:** Arched auras can be focused from the overlay, resized, mirrored, rotated, thickened, and optionally straightened.
  - **Recording overlay:** Added a quick action for creating arched auras while using the overlay controls.

  Note: Arched Aura is running at 24 fps, as it's pretty dense on performance. We may try to optimize it in the near future.

  The next Minor release will contain Pointer Selection. Idea is to connect `n` amount of pointers to create a straight line.
  This will be helpful to track Ward resource.

  Pointer Selection is the last planned aura selection type.

## 0.3.0

### Minor Changes

- [`61335ed`](https://github.com/navali-creations/hinekora/commit/61335edaa4ac9237997fb0a66e85f51eaa042bf6) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make game detection, Live Preview, and window controls more reliable.

  Hinekora now tracks Path of Exile windows more accurately, keeps capture sources in sync when the game appears, and remembers app window placement between launches.

  - **Game status:** Path of Exile 1 and Path of Exile 2 detection now handles shared Steam and standalone process names more carefully.
  - **Live Preview:** Capture sources refresh again when a running game window appears shortly after process detection.
  - **Windows and tray:** The main app and recording controls remember their positions, and the tray menu now includes Help, GitHub, Discord, and Quit actions.
  - **Overlays:** Aura and recording overlays behave more predictably when games close, focus changes, or overlay setup windows are dismissed.

### Patch Changes

- [`948cdf9`](https://github.com/navali-creations/hinekora/commit/948cdf9894a1085b79ac5d75467bc2bd2d19b2d6) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Keep overlays steady while editing auras and crop regions.

  Hinekora now handles overlay setup focus more carefully, so recording controls and aura overlays stay visible when setup tools briefly take focus from the game.

  - **Aura editing:** Unlocking aura editing no longer makes recording controls flash off before crop selection opens.
  - **Crop selection:** Closing the grid selector keeps overlays steady while focus returns to the game.
  - **Game focus:** Overlay visibility now follows the latest Path of Exile focus events instead of assuming focus from the app window or running process.

- [`f859683`](https://github.com/navali-creations/hinekora/commit/f85968399ba687cfb91829c1dac3f4e34f612cea) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Make the aura lock prompt easier to notice.

  The “Auras locked” hint now appears near the top of the aura overlay with a clearer lock icon, matching status color, and a brief beige shimmer before it fades away.

  - **Aura editing:** The lock handoff message is larger and easier to read when control returns to the game.
  - **Visual polish:** The hint now matches Hinekora’s beige overlay styling while using the same running-status accent for the lock label.

- [`6ff5ca0`](https://github.com/navali-creations/hinekora/commit/6ff5ca007c4a89f05623df59f8d7a4735250d1c0) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Keep aura positions steady after dragging or resizing.

  Aura overlays now stay where you release them while Hinekora saves the edit, instead of briefly jumping back or continuing to follow the cursor after the mouse button is released.

  - **Aura editing:** Dragged auras hold their released position while the save finishes.
  - **Aura resizing:** Resized auras keep their released size and ignore extra pointer movement after release.

- [`69cf19f`](https://github.com/navali-creations/hinekora/commit/69cf19f9be78c7b23b24ce0695b05dfac6a16496) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Hide setup overlays when focus moves away from the game and Hinekora overlays.

  Aura editing and crop selection overlays now step out of the way if you focus another app while the game is unfocused, then return when Path of Exile is focused again.

  - **Aura editing:** Unlocked aura overlays no longer keep the monitor blocked after focus moves elsewhere.
  - **Crop selection:** The grid selector pauses without canceling the pending selection, then restores when you return to the game.

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
