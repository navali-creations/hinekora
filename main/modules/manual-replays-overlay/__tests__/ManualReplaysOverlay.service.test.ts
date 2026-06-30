import { describe, expect, it, vi } from "vitest";

import type { DeathClipsOverlayService } from "~/main/modules/death-clips-overlay";

import type { ReplayClip } from "~/types";
import { ManualReplaysOverlayService } from "../ManualReplaysOverlay.service";

describe("ManualReplaysOverlayService", () => {
  it("delegates manual replay preview actions to the shared clip overlay", async () => {
    const deathClipsOverlay = {
      hide: vi.fn(),
      showClip: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeathClipsOverlayService;
    const clip = { id: "clip-1" } as ReplayClip;
    const service = new ManualReplaysOverlayService(deathClipsOverlay);

    await expect(service.showClip(clip)).resolves.toBeUndefined();
    service.hide();

    expect(deathClipsOverlay.showClip).toHaveBeenCalledWith(clip);
    expect(deathClipsOverlay.hide).toHaveBeenCalledTimes(1);
  });
});
