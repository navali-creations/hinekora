import { beforeEach, describe, expect, it, vi } from "vitest";

const ipcRendererMocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("electron", () => ({
  ipcRenderer: { invoke: ipcRendererMocks.invoke },
}));

import { SavedVideosAPI } from "../SavedVideos.api";
import { SavedVideosChannel } from "../SavedVideos.channels";

describe("SavedVideosAPI", () => {
  beforeEach(() => {
    ipcRendererMocks.invoke.mockReset();
    ipcRendererMocks.invoke.mockResolvedValue({
      ok: true,
      value: { ok: true },
    });
  });

  it("invokes the bounded saved-video channels", async () => {
    await SavedVideosAPI.listLibrary({ pageSize: 10 });
    await SavedVideosAPI.open("video-id");
    await SavedVideosAPI.reveal("video-id");
    await SavedVideosAPI.delete("video-id");

    expect(ipcRendererMocks.invoke.mock.calls).toEqual([
      [SavedVideosChannel.ListLibrary, { pageSize: 10 }],
      [SavedVideosChannel.Open, "video-id"],
      [SavedVideosChannel.Reveal, "video-id"],
      [SavedVideosChannel.Delete, "video-id"],
    ]);
  });
});
