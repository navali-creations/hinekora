import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordingBookmarksQuery } from "~/main/modules/bookmarks";
import { useBoundStore } from "~/renderer/store";

import { useRecordingBookmarksQuery } from "./useRecordingBookmarksQuery";

function RecordingBookmarksQueryHarness({
  refresh,
}: {
  refresh: (query: RecordingBookmarksQuery) => Promise<void>;
}) {
  useRecordingBookmarksQuery({
    isReady: true,
    pageIndex: 0,
    recordingId: "recording-1",
    refresh,
    searchText: "",
  });

  return null;
}

describe("useRecordingBookmarksQuery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    useBoundStore.getState().bookmarks.resetRecordingDetail();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("stores refresh failures in the recording detail panel workflow", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("Query failed"));

    await act(async () => {
      root.render(<RecordingBookmarksQueryHarness refresh={refresh} />);
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledWith({
      includeTimeline: false,
      pageIndex: 0,
      pageSize: 5,
    });
    expect(useBoundStore.getState().bookmarks.recordingDetail).toEqual(
      expect.objectContaining({
        errorMessage: "Query failed",
        isLoading: false,
      }),
    );
  });
});
