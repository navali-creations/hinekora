import { describe, expect, it, vi } from "vitest";

import { isNoobsApi, loadNoobsApi } from "../ManagedRecorder.noobs";

function createNoobsApi() {
  return {
    ForceStopRecording: vi.fn(),
    GetLastRecording: vi.fn<() => string | null>(() => null),
    Init: vi.fn(),
    SetBuffering: vi.fn(),
    StartBuffer: vi.fn(),
    StartRecording: vi.fn(),
    StopRecording: vi.fn(),
  };
}

describe("ManagedRecorder noobs helpers", () => {
  it("validates required noobs API methods", () => {
    expect(isNoobsApi(null)).toBe(false);
    expect(isNoobsApi({ Init: vi.fn() })).toBe(false);
    expect(isNoobsApi(createNoobsApi())).toBe(true);
  });

  it("loads noobs from default and direct module shapes", async () => {
    const noobs = createNoobsApi();
    const defaultImporter = vi.fn().mockResolvedValue({ default: noobs });

    await expect(loadNoobsApi(defaultImporter)).resolves.toBe(noobs);
    expect(defaultImporter).toHaveBeenCalledWith("noobs");

    await expect(loadNoobsApi(vi.fn().mockResolvedValue(noobs))).resolves.toBe(
      noobs,
    );
  });

  it("returns null for invalid imported APIs", async () => {
    await expect(
      loadNoobsApi(vi.fn().mockResolvedValue({ default: { Init: vi.fn() } })),
    ).resolves.toBeNull();
  });
});
