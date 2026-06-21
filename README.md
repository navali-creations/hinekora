# Hinekora

Hinekora is a gameplay recorder tailored for Path of Exile players who want gameplay recording, quick death clips, simple replay editing, and aura overlays

---

[![Download Latest Release](https://img.shields.io/github/v/release/navali-creations/hinekora?style=for-the-badge&label=Download+Latest+Release&labelColor=211b18&color=f5e6c8)](https://github.com/navali-creations/hinekora/releases/latest)


[![Downloads](https://img.shields.io/github/downloads/navali-creations/hinekora/total?style=for-the-badge&label=Downloads&labelColor=211b18&color=f5e6c8)](https://github.com/navali-creations/hinekora/releases)

| system | extension |
| -- | -- |
| Windows | `Hinekora-x.y.z.Setup.exe` |

---

## What It Does

- Records Path of Exile gameplay.
- Keeps a rewind buffer so recent moments can be saved as clips.
- Automatically saves death clips when the game log detects a death.
- Lets you trim, split, reorder, save, and copy clips from the built-in editor.
- Manages aura overlays for tracking important on-screen buffs or effects.
- Organizes recordings, death clips, and manual replay saves in one place.

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
