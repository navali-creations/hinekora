import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SavedVideoItem,
  SavedVideosLibraryPage,
} from "~/main/modules/saved-videos";

const storeMocks = vi.hoisted(() => ({
  deleteVideo: vi.fn(),
  error: null as string | null,
  hydrateLibrary: vi.fn(),
  isLoading: false,
  items: [] as SavedVideoItem[],
  libraryPage: null as SavedVideosLibraryPage | null,
  openVideo: vi.fn(),
  refreshLibrary: vi.fn(),
  revealVideo: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSavedVideosShallow: (selector: (state: typeof storeMocks) => unknown) =>
    selector(storeMocks),
}));

import { SavedVideosPanel } from "./SavedVideosPanel";

const video: SavedVideoItem = {
  fileName: "Saved.mp4",
  id: "a".repeat(64),
  savedAt: "2026-07-21T00:00:00.000Z",
  sizeBytes: 1024,
  sourceProjectId: null,
};
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  storeMocks.error = null;
  storeMocks.isLoading = false;
  storeMocks.items = [video];
  storeMocks.libraryPage = {
    isTruncated: false,
    items: [video],
    pageCount: 1,
    pageIndex: 0,
    pageSize: 20,
    sortBy: "savedAt",
    sortDirection: "desc",
    totalCount: 1,
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  document.body.replaceChildren();
});

describe("SavedVideosPanel", () => {
  it("renders export metadata and opens a clicked row", async () => {
    await act(async () => {
      root.render(<SavedVideosPanel />);
    });

    expect(container.textContent).toContain("Saved.mp4");
    expect(container.textContent).toContain("1.0 KB");
    expect(storeMocks.hydrateLibrary).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 20,
      sortBy: "savedAt",
      sortDirection: "desc",
    });
    await act(async () => {
      container
        .querySelector("tbody tr")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(storeMocks.openVideo).toHaveBeenCalledWith(video.id);
  });

  it("shows scan truncation and library errors", async () => {
    storeMocks.error = "Exports unavailable";
    storeMocks.libraryPage = {
      ...storeMocks.libraryPage!,
      isTruncated: true,
    };
    await act(async () => {
      root.render(<SavedVideosPanel />);
    });

    expect(container.textContent).toContain("Only part of this very large");
    expect(container.textContent).toContain("Exports unavailable");
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button.btn-error")?.click();
    });
    expect(storeMocks.refreshLibrary).toHaveBeenCalledOnce();
  });

  it("shows a loading state before the first page arrives", async () => {
    storeMocks.isLoading = true;
    storeMocks.items = [];
    storeMocks.libraryPage = null;

    await act(async () => {
      root.render(<SavedVideosPanel />);
    });

    expect(container.textContent).toContain("Loading saved videos...");
  });
});
