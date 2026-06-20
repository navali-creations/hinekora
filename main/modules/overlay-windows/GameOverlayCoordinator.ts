import type { BrowserWindow } from "electron";

import {
  hideGameOverlayWindow,
  showGameOverlayWindow,
  suspendGameOverlayWindow,
} from "./OverlayWindow.shared";

const SHOULD_GATE_GAME_OVERLAYS_TO_POE_FOCUS = true;
const SHOULD_GATE_GAME_OVERLAYS_TO_GAME_RUNNING = true;

interface GameOverlayParticipant {
  restoreRequestedOverlay(): Promise<void> | void;
  suspendRequestedOverlay(): void;
}

class GameOverlayCoordinator {
  private readonly participants: GameOverlayParticipant[] = [];
  private poeFocusActive = false;
  private gameRunningActive = false;
  private restoringGameOverlays = false;

  register(participant: GameOverlayParticipant): void {
    if (!this.participants.includes(participant)) {
      this.participants.push(participant);
    }
  }

  setPoeFocusActive(active: boolean): void {
    if (this.poeFocusActive === active) {
      return;
    }

    this.poeFocusActive = active;
    void this.applyFocusGateToGameOverlays();
  }

  setGameRunningActive(active: boolean): void {
    if (this.gameRunningActive === active) {
      return;
    }

    this.gameRunningActive = active;
    void this.applyFocusGateToGameOverlays();
  }

  canShowGameOverlays(): boolean {
    const focusAllowed =
      !SHOULD_GATE_GAME_OVERLAYS_TO_POE_FOCUS || this.poeFocusActive;
    const runningAllowed =
      !SHOULD_GATE_GAME_OVERLAYS_TO_GAME_RUNNING || this.gameRunningActive;

    return focusAllowed && runningAllowed;
  }

  showOrHideGameOverlayWindow(window: BrowserWindow | null): void {
    if (this.canShowGameOverlays()) {
      this.showGameOverlayWindow(window);
      return;
    }

    this.suspendGameOverlayWindow(window);
  }

  showGameOverlayWindow(window: BrowserWindow | null): void {
    showGameOverlayWindow(window);
  }

  hideGameOverlayWindow(window: BrowserWindow | null): void {
    hideGameOverlayWindow(window);
  }

  suspendGameOverlayWindow(window: BrowserWindow | null): void {
    suspendGameOverlayWindow(window);
  }

  async applyFocusGateToGameOverlays(): Promise<void> {
    if (!this.canShowGameOverlays()) {
      this.restoringGameOverlays = false;
      for (const participant of this.participants) {
        participant.suspendRequestedOverlay();
      }
      return;
    }

    if (this.restoringGameOverlays) {
      return;
    }

    this.restoringGameOverlays = true;
    try {
      for (const participant of this.participants) {
        await participant.restoreRequestedOverlay();
      }
    } finally {
      this.restoringGameOverlays = false;
    }
  }
}

export type { GameOverlayParticipant };
export { GameOverlayCoordinator };
