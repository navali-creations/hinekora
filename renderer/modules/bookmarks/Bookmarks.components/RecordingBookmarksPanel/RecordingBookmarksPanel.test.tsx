import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordingBookmark } from "~/main/modules/bookmarks";
import { useBoundStore } from "~/renderer/store";

import { RecordingBookmarksPanel } from "./RecordingBookmarksPanel";

function createBookmark(
  overrides: Partial<RecordingBookmark> = {},
): RecordingBookmark {
  return {
    category: "map",
    createdAt: "2026-07-03T10:00:00.000Z",
    durationSeconds: 30,
    id: "bookmark-1",
    label: "Qimah Reservoir",
    note: null,
    occurredAt: "2026-07-03T10:00:05.000Z",
    offsetSeconds: 5,
    sceneName: "Qimah Reservoir",
    source: "client-log",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    subcategory: null,
    updatedAt: "2026-07-03T10:00:00.000Z",
    ...overrides,
  };
}

describe("RecordingBookmarksPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    useBoundStore.getState().bookmarks.resetRecordingDetail();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders custom empty copy for the owning detail page", () => {
    act(() => {
      root.render(
        <RecordingBookmarksPanel
          bookmarks={[]}
          categories={[]}
          categoryCounts={[]}
          emptyMessage="No bookmarks are attached to this rewind yet."
          heightPixels={null}
          owner="recordingDetail"
          pageCount={1}
          totalCount={0}
          onSelectBookmark={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain(
      "No bookmarks are attached to this rewind yet.",
    );
  });

  it("renders loading and error states from the owning panel store", () => {
    act(() => {
      useBoundStore.getState().bookmarks.setRecordingDetailPanelStatus({
        errorMessage: null,
        isLoading: true,
      });
      root.render(
        <RecordingBookmarksPanel
          bookmarks={[]}
          categories={[]}
          categoryCounts={[]}
          heightPixels={null}
          owner="recordingDetail"
          pageCount={1}
          totalCount={0}
          onSelectBookmark={vi.fn()}
        />,
      );
    });

    expect(container.querySelector(".loading-spinner")).not.toBeNull();

    act(() => {
      useBoundStore.getState().bookmarks.setRecordingDetailPanelStatus({
        errorMessage: "Bookmark query failed",
        isLoading: false,
      });
    });

    expect(container.textContent).toContain("Bookmark query failed");
    expect(container.textContent).not.toContain(
      "No bookmarks are attached yet.",
    );
  });

  it("allows category chips to render with no active chip", () => {
    act(() => {
      root.render(
        <RecordingBookmarksPanel
          bookmarks={[]}
          categories={["map"]}
          categoryCounts={[]}
          heightPixels={null}
          owner="recordingDetail"
          pageCount={1}
          totalCount={0}
          onSelectBookmark={vi.fn()}
        />,
      );
    });

    const allCategoryButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.dataset.bookmarkCategoryChip === "__all__");

    expect(allCategoryButton?.className).not.toContain("shadow-sm");
  });

  it("fires category, pagination, selection, and hover interactions", () => {
    const bookmark = createBookmark();
    const onSelectBookmark = vi.fn();
    useBoundStore
      .getState()
      .bookmarks.setRecordingDetailSelectedBookmarkId(bookmark.id);

    act(() => {
      root.render(
        <RecordingBookmarksPanel
          bookmarks={[bookmark]}
          categories={["map", "death"]}
          categoryCounts={[
            { category: "map", count: 4 },
            { category: "death", count: 2 },
          ]}
          heightPixels={null}
          owner="recordingDetail"
          pageCount={2}
          totalCount={6}
          onSelectBookmark={onSelectBookmark}
        />,
      );
    });

    const mapCategoryButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.dataset.bookmarkCategoryChip === "map");
    const allCategoryButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.dataset.bookmarkCategoryChip === "__all__");

    expect(allCategoryButton?.textContent).toContain("All (6)");
    expect(mapCategoryButton?.textContent).toContain("Map (4)");
    act(() => {
      mapCategoryButton?.click();
    });
    expect(
      useBoundStore.getState().bookmarks.recordingDetail.categoryFilter,
    ).toBe("map");

    const bookmarkButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Qimah Reservoir"));
    expect(bookmarkButton).toBeDefined();
    expect(bookmarkButton?.className).toContain("border-primary");

    act(() => {
      bookmarkButton?.dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true }),
      );
      bookmarkButton?.click();
      bookmarkButton?.dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true }),
      );
    });
    expect(onSelectBookmark).toHaveBeenCalledWith(bookmark);
    expect(
      useBoundStore.getState().bookmarks.recordingDetail.hoveredBookmarkId,
    ).toBeNull();

    const searchInput = container.querySelector<HTMLInputElement>(
      "input[aria-label='Search bookmark zones']",
    );
    expect(searchInput?.parentElement?.className).toContain("input-xs");
    expect(searchInput?.parentElement?.parentElement).not.toBe(
      allCategoryButton?.parentElement?.parentElement,
    );
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      if (searchInput) {
        valueSetter?.call(searchInput, "atlas");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(useBoundStore.getState().bookmarks.recordingDetail.searchText).toBe(
      "atlas",
    );

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          "button[aria-label='Next bookmark page']",
        )
        ?.click();
    });
    expect(useBoundStore.getState().bookmarks.recordingDetail.pageIndex).toBe(
      1,
    );
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          "button[aria-label='Previous bookmark page']",
        )
        ?.click();
    });
    expect(useBoundStore.getState().bookmarks.recordingDetail.pageIndex).toBe(
      0,
    );
  });

  it("places a compact search input in the header when requested", () => {
    act(() => {
      root.render(
        <RecordingBookmarksPanel
          bookmarks={[]}
          categories={[]}
          categoryCounts={[]}
          heightPixels={null}
          owner="recordingDetail"
          pageCount={1}
          searchPlacement="header"
          totalCount={0}
          onSelectBookmark={vi.fn()}
        />,
      );
    });

    const panelHeader = container.querySelector("aside")?.firstElementChild;
    const searchInput = container.querySelector<HTMLInputElement>(
      "input[aria-label='Search bookmark zones']",
    );

    expect(panelHeader?.contains(searchInput ?? null)).toBe(true);
    expect(searchInput?.parentElement?.className).toContain("w-36");
  });
});
