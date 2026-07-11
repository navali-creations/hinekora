import { describe, expect, it, vi } from "vitest";

import { createReplayClip } from "~/main/test/factories/replayClip";

import type { ReplayTriggerEvent } from "../ReplayClips.dto";
import { ReplayClipTriggerCoordinator } from "../ReplayClips.trigger";
import { createDeferred } from "./ReplayClips.service.test-harness";

function createEvent(kind: "death" | "manual"): ReplayTriggerEvent {
  return {
    detectedAt: "2026-07-10T00:00:00.000Z",
    game: "poe2",
    kind,
    line: kind,
    lineHash: `${kind}-hash`,
  };
}

describe("ReplayClipTriggerCoordinator", () => {
  it("coalesces events into one active request and resolves the batch", async () => {
    const coordinator = new ReplayClipTriggerCoordinator();
    const gate = createDeferred();
    const clip = createReplayClip();
    const execute = vi.fn(async () => {
      await gate.promise;
      return clip;
    });
    const onCoalesced = vi.fn();
    const resolveBatch = vi.fn(
      async (result, _events: ReplayTriggerEvent[]) => result,
    );
    const execution = { execute, onCoalesced, resolveBatch };

    const manual = coordinator.run(createEvent("manual"), execution);
    const death = coordinator.run(createEvent("death"), execution);
    gate.resolve();

    await expect(manual).resolves.toBe(clip);
    await expect(death).resolves.toBe(clip);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(onCoalesced).toHaveBeenCalledWith(createEvent("death"));
    expect(resolveBatch.mock.calls[0]?.[1]).toHaveLength(2);
  });

  it("accepts a new request after a failed execution", async () => {
    const coordinator = new ReplayClipTriggerCoordinator();
    const execution = {
      execute: vi
        .fn<() => Promise<ReturnType<typeof createReplayClip>>>()
        .mockRejectedValueOnce(new Error("save failed"))
        .mockResolvedValueOnce(createReplayClip()),
      onCoalesced: vi.fn(),
      resolveBatch: vi.fn(async (clip) => clip),
    };

    await expect(
      coordinator.run(createEvent("manual"), execution),
    ).rejects.toThrow("save failed");
    await expect(
      coordinator.run(createEvent("manual"), execution),
    ).resolves.toMatchObject({ id: "clip-1" });
  });
});
