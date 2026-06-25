# Hinekora

Hinekora is a gameplay recorder tailored for Path of Exile 1 and Path of Exile 2 players who want gameplay recording, quick death clips, simple replay editing, and aura overlays

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
- Organizes recordings, death clips, and manual replay saves in one place.

> [!WARNING]
> Just like any software, use it at your own risk. The Aura Manager feature fall into a grey area of what is and is not allowed by GGG's Terms of Service. There is no mention of mirroring ui in ToS as of 6th Jun 2025. If you feel this information may be outdated, please create an issue. [Link to GGG Terms of Service](https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy)

- Manages aura overlays for tracking important on-screen buffs or effects.
> [!NOTE]
> Aura overlays do NOT read in game memory. It's an OBS mirrored scene, using OBS bindings. See https://github.com/aza547/noobs

https://github.com/user-attachments/assets/a4b70f85-0d7f-4602-ad0a-2e07cd6988f0

https://github.com/user-attachments/assets/029f0a36-8e8b-446b-860e-4b6dc48a6dcd

https://github.com/user-attachments/assets/ceb8da34-6f51-48c7-b823-d528299de07c

https://github.com/user-attachments/assets/6f033449-ba8f-4a0b-91c3-e66250101088

https://github.com/user-attachments/assets/437220a9-609f-4bf8-ac0b-7ea4c4334e94


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

## Attributions

Special thanks to the following projects and people whose work made this project possible or served as inspiration:

- [OBS Project](https://github.com/obsproject) - for the recording infrastructure
- [Warcraft Recorder](https://warcraftrecorder.com/) - Hinekora is inspired by this project
- [Alex, the creator of Warcraft Recorder, and the maintainers of the noobs package](https://github.com/aza547/noobs) - for their work

## Legal Notice

Hinekora is an independent, community-developed open-source project.

This project is not affiliated with, endorsed by, or sponsored by Grinding Gear Games. Path of Exile and all related names, assets, and trademarks are the property of Grinding Gear Games.

This project does not include or distribute any proprietary game assets.
