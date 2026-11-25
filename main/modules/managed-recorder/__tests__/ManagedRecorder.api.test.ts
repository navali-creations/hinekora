import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: electronMocks,
}));

import { ManagedRecorderAPI } from "../ManagedRecorder.api";
import { ManagedRecorderChannel } from "../ManagedRecorder.channels";

describe("ManagedRecorderAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the read-only audio output state", async () => {
    electronMocks.invoke.mockResolvedValue("unavailable");
    await expect(ManagedRecorderAPI.getAudioOutputState()).resolves.toBe(
      "unavailable",
    );
    expect(electronMocks.invoke).toHaveBeenCalledWith(
      ManagedRecorderChannel.GetAudioOutputState,
    );
  });

  it("rejects storage estimate validation failures", async () => {
    electronMocks.invoke.mockResolvedValue({
      error: "Invalid estimate configuration",
      ok: false,
    });

    await expect(
      ManagedRecorderAPI.getRecordingStorageEstimates({
        configurations: [
          {
            encoder: "hardware_h264",
            fps: 60,
            key: "planner",
            quality: "moderate",
          },
        ],
      }),
    ).rejects.toThrow("Invalid estimate configuration");
  });

  it("returns successful storage estimates unchanged", async () => {
    const response = { configurations: [] };
    electronMocks.invoke.mockResolvedValue(response);

    await expect(
      ManagedRecorderAPI.getRecordingStorageEstimates({
        configurations: [
          {
            encoder: "hardware_h264",
            fps: 60,
            key: "planner",
            quality: "moderate",
          },
        ],
      }),
    ).resolves.toBe(response);
  });
});
