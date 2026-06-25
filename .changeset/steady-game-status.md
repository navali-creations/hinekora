---
"hinekora": patch
---

**Fixed:** Show the correct Path of Exile game as running.

Hinekora now handles Steam's generic Path of Exile process more carefully, so playing Path of Exile 2 should no longer make Path of Exile 1 appear as the running game.

- **Game status:** Generic Steam process detection now uses the game window title when available instead of guessing from the selected game.
- **Game switching:** Re-selecting the current game no longer restarts the Client.txt watcher or refreshes game status unnecessarily.
