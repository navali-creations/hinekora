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
