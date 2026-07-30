import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordingBookmarksPage } from "~/main/modules/bookmarks";
import type { RunRecordingDetail } from "~/main/modules/recording-storage";

import { useRecordingDetailData } from "./useRecordingDetailData";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve = (_value: T): void => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function createBookmarksPage(): RecordingBookmarksPage {
  return {
    availableCategories: [],
    categoryCounts: [],
    items: [],
    pageCount: 1,
    pageIndex: 0,
    pageSize: 5,
    timelineItems: [],
    timelineItemsTruncated: false,
    totalCount: 0,
  };
}

function createRecordingDetail(id: string): RunRecordingDetail {
  const timestamp = "2026-07-30T12:00:00.000Z";

  return {
    mediaUrl: `media://${id}`,
    recording: {
      createdAt: timestamp,
      durationSeconds: 60,
      exists: true,
      fileName: `${id}.mp4`,
      id,
      path: `${id}.mp4`,
      sizeBytes: 1_024,
      sourceGame: "poe2",
      sourceLeague: "Standard",
      startedAt: timestamp,
      stoppedAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

type RecordingDetailData = ReturnType<typeof useRecordingDetailData>;

function RecordingDetailDataHarness({
  onRender,
  recordingId,
}: {
  onRender: (state: RecordingDetailData) => void;
  recordingId: string;
}) {
  const state = useRecordingDetailData(recordingId);
  onRender(state);

  return null;
}

describe("useRecordingDetailData", () => {
  let container: HTMLDivElement;
  let electronDescriptor: PropertyDescriptor | undefined;
  let latestState: RecordingDetailData | null;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    electronDescriptor = Object.getOwnPropertyDescriptor(window, "electron");
    latestState = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (electronDescriptor) {
      Object.defineProperty(window, "electron", electronDescriptor);
    } else {
      Reflect.deleteProperty(window, "electron");
    }
  });

  it("keeps route detail requests independent from stale bookmark refreshes", async () => {
    const firstDetailRequest = createDeferred<RunRecordingDetail>();
    const firstPageRequest = createDeferred<RecordingBookmarksPage>();
    const staleRefreshRequest = createDeferred<RecordingBookmarksPage>();
    const secondDetailRequest = createDeferred<RunRecordingDetail>();
    const secondPageRequest = createDeferred<RecordingBookmarksPage>();
    const getRecording = vi.fn((recordingId: string) =>
      recordingId === "recording-1"
        ? firstDetailRequest.promise
        : secondDetailRequest.promise,
    );
    const listRecording = vi.fn(
      (
        recordingId: string,
        query: { includeTimeline?: boolean },
      ): Promise<RecordingBookmarksPage> => {
        if (recordingId === "recording-1" && query.includeTimeline === false) {
          return staleRefreshRequest.promise;
        }

        return recordingId === "recording-1"
          ? firstPageRequest.promise
          : secondPageRequest.promise;
      },
    );
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        bookmarks: { listRecording },
        recordingStorage: { getRecording },
      } as unknown as typeof window.electron,
    });
    const handleRender = (state: RecordingDetailData) => {
      latestState = state;
    };

    await act(async () => {
      root.render(
        <RecordingDetailDataHarness
          onRender={handleRender}
          recordingId="recording-1"
        />,
      );
    });
    await act(async () => {
      firstDetailRequest.resolve(createRecordingDetail("recording-1"));
      firstPageRequest.resolve(createBookmarksPage());
      await Promise.all([firstDetailRequest.promise, firstPageRequest.promise]);
    });

    expect(latestState?.loadedRecordingId).toBe("recording-1");

    let staleRefreshPromise: Promise<void> | null = null;
    await act(async () => {
      staleRefreshPromise =
        latestState?.refreshBookmarksPage({
          includeTimeline: false,
          pageIndex: 0,
          pageSize: 5,
        }) ?? null;
      await Promise.resolve();
    });
    await act(async () => {
      root.render(
        <RecordingDetailDataHarness
          onRender={handleRender}
          recordingId="recording-2"
        />,
      );
    });

    expect(latestState).toEqual(
      expect.objectContaining({
        bookmarksPage: null,
        detail: null,
        isLoading: true,
        loadedRecordingId: null,
      }),
    );

    await act(async () => {
      staleRefreshRequest.resolve(createBookmarksPage());
      await staleRefreshPromise;
    });

    expect(latestState).toEqual(
      expect.objectContaining({
        bookmarksPage: null,
        detail: null,
        isLoading: true,
        loadedRecordingId: null,
      }),
    );

    await act(async () => {
      secondDetailRequest.resolve(createRecordingDetail("recording-2"));
      secondPageRequest.resolve(createBookmarksPage());
      await Promise.all([
        secondDetailRequest.promise,
        secondPageRequest.promise,
      ]);
    });

    expect(latestState).toEqual(
      expect.objectContaining({
        detail: expect.objectContaining({
          recording: expect.objectContaining({ id: "recording-2" }),
        }),
        isLoading: false,
        loadedRecordingId: "recording-2",
      }),
    );
  });
});
