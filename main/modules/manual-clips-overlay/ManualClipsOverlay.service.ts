import type { DeathClipsOverlayService } from "~/main/modules/death-clips-overlay";

import type { ReplayClip } from "~/types";

class ManualClipsOverlayService {
  constructor(private readonly deathClipsOverlay: DeathClipsOverlayService) {}

  showClip(clip: ReplayClip): Promise<void> {
    return this.deathClipsOverlay.showClip(clip);
  }

  hide(): void {
    this.deathClipsOverlay.hide();
  }
}

export { ManualClipsOverlayService };
