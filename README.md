# Hinekora
Hinekora is a desktop companion app for players who want clean gameplay
recording, quick death clips, simple replay editing, and aura overlays without
digging through recording software.

## What It Does

- Records Path of Exile gameplay.
- Keeps a rewind buffer so recent moments can be saved as clips.
- Automatically saves death clips when the game log detects a death.
- Lets you trim, split, reorder, save, and copy clips from the built-in editor.
- Manages aura overlays for tracking important on-screen buffs or effects.
- Organizes recordings, death clips, and manual replay saves in one place.

## Why Hinekora?

Path of Exile can be busy, fast, and hard to review after the fact. Hinekora is
made to sit beside the game and handle the recording workflow for you, so you can
focus on playing and still keep the moments that matter.

## Current Status

Hinekora is under active development. The app already has recording, replay
clips, editor, and aura manager screens, but the public release flow is still
being shaped.

There is no polished installer yet. If you are not comfortable running apps from
source, it is better to wait for a packaged release.

## For Developers

### Requirements

- Node.js 24 or newer
- pnpm 11 or newer

### Commands

- `pnpm install`
- `pnpm dev` launches the Electron desktop app
- `pnpm check` runs formatting and lint checks
- `pnpm test` runs the main and renderer test suites
- `pnpm build` packages the Electron app

End users should not need `pnpm`, environment variables, or development helpers.
Those are development-only pieces until the app has a packaged installer.
