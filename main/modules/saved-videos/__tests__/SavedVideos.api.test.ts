import { beforeEach, describe, expect, it, vi } from "vitest";

const ipcRendererMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: ipcRendererMocks,
}));

import { SavedVideosAPI } from "../SavedVideos.api";
import { SavedVideosChannel } from "../SavedVideos.channels";

describe("SavedVideosAPI", () => {
  beforeEach(() => {
    ipcRendererMocks.invoke.mockReset();
    ipcRendererMocks.on.mockReset();
    ipcRendererMocks.removeListener.mockReset();
    ipcRendererMocks.invoke.mockResolvedValue({
      ok: true,
      value: { ok: true },
    });
  });

  it("subscribes and unsubscribes from library changes", () => {
    const callback = vi.fn();
    const unsubscribe = SavedVideosAPI.onLibraryChanged(callback);
    const listener = ipcRendererMocks.on.mock.calls[0]?.[1];

    listener?.({});
    expect(callback).toHaveBeenCalledOnce();
    unsubscribe();
    expect(ipcRendererMocks.removeListener).toHaveBeenCalledWith(
      SavedVideosChannel.LibraryChanged,
      listener,
    );
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
