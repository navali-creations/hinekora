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
    ipcRendererMocks.invoke.mockResolvedValue({ error: null, ok: true });
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
    ipcRendererMocks.invoke
      .mockResolvedValueOnce({
        isTruncated: false,
        items: [],
        pageCount: 1,
        pageIndex: 0,
        pageSize: 10,
        sortBy: "savedAt",
        sortDirection: "desc",
        totalCount: 0,
      })
      .mockResolvedValue({ error: null, ok: true });

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

  it("rejects malformed saved-video IPC responses", async () => {
    ipcRendererMocks.invoke.mockResolvedValue({
      isTruncated: false,
      items: [],
      pageCount: 0,
      pageIndex: 0,
      pageSize: 10,
      sortBy: "savedAt",
      sortDirection: "desc",
      totalCount: 0,
    });
    await expect(SavedVideosAPI.listLibrary()).rejects.toThrow();

    ipcRendererMocks.invoke.mockResolvedValue({ error: null });
    await expect(SavedVideosAPI.open("video-id")).rejects.toThrow();

    ipcRendererMocks.invoke.mockResolvedValue({
      error: "saved video id is invalid",
      ok: false,
    });
    await expect(SavedVideosAPI.delete("video-id")).rejects.toThrow(
      "saved video id is invalid",
    );
  });
});
