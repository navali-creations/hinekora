import { describe, expect, it } from "vitest";

import {
  createEditorTestAsset,
  createEditorTestProject,
  createEditorTestRecordingBookmark,
  createEditorTestTimelineClip,
} from "../../../Editor.slice/Editor.slice.test-utils";
import {
  isEditorBookmarkInTimelineRange,
  resolveEditorBookmarkTimelineHighlightItem,
  resolveEditorBookmarkTimelineItem,
  resolveEditorBookmarkTimelineItems,
  resolveEditorBookmarkTimelineSeconds,
  resolveEditorRecordingBookmarkSource,
} from "./useEditorRecordingBookmarks.utils";

describe("editor recording bookmarks utilities", () => {
  it("resolves the selected timeline recording source", () => {
    const recordingAsset = createEditorTestAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      id: "recording-1",
      kind: "recording",
      name: "recording-1.mp4",
      subtitle: "Run recording - Standard",
    });
    const clipAsset = createEditorTestAsset();
    const recordingClip = createEditorTestTimelineClip(recordingAsset, {
      assetKey: recordingAsset.assetKey,
      id: "timeline-recording",
    });
    const clip = createEditorTestTimelineClip(clipAsset, {
      assetKey: clipAsset.assetKey,
      id: "timeline-clip",
      startSeconds: 5,
    });
    const project = createEditorTestProject(recordingAsset, {
      activeClipId: "timeline-clip",
      assets: [recordingAsset, clipAsset],
      selectedAssetKey: clipAsset.assetKey,
      tracks: [
        {
          clips: [recordingClip, clip],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });

    expect(
      resolveEditorRecordingBookmarkSource({
        project,
        selectedClipId: "timeline-recording",
      }),
    ).toEqual({
      assetKey: "recording:recording-1",
      clipId: "timeline-recording",
      id: "recording-1",
      name: "recording-1.mp4",
    });
  });

  it("does not resolve bookmarks from another clip when the selected clip is not a recording", () => {
    const recordingAsset = createEditorTestAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      id: "recording-1",
      kind: "recording",
    });
    const clipAsset = createEditorTestAsset({
      assetKey: "clip:highlight-1",
      id: "highlight-1",
      kind: "clip",
    });
    const project = createEditorTestProject(recordingAsset, {
      activeClipId: "timeline-recording",
      assets: [recordingAsset, clipAsset],
      tracks: [
        {
          clips: [
            createEditorTestTimelineClip(recordingAsset, {
              id: "timeline-recording",
            }),
            createEditorTestTimelineClip(clipAsset, {
              assetKey: clipAsset.assetKey,
              id: "timeline-highlight",
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });

    expect(
      resolveEditorRecordingBookmarkSource({
        project,
        selectedClipId: "timeline-highlight",
      }),
    ).toBeNull();
  });

  it("maps recording bookmark offsets through the visible editor clip range", () => {
    const recordingAsset = createEditorTestAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      durationSeconds: 20,
      id: "recording-1",
      kind: "recording",
    });
    const project = createEditorTestProject(recordingAsset, {
      tracks: [
        {
          clips: [
            createEditorTestTimelineClip(recordingAsset, {
              durationSeconds: 8,
              id: "timeline-recording",
              inSeconds: 3,
              outSeconds: 11,
              sourceOutSeconds: 20,
              startSeconds: 10,
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const bookmark = createEditorTestRecordingBookmark({ offsetSeconds: 7 });

    expect(
      resolveEditorBookmarkTimelineSeconds({
        bookmark,
        project,
        recordingAssetKey: recordingAsset.assetKey,
        recordingClipId: "timeline-recording",
      }),
    ).toBe(14);
    expect(
      resolveEditorBookmarkTimelineItem({
        bookmark,
        project,
        recordingAssetKey: recordingAsset.assetKey,
        recordingClipId: "timeline-recording",
      }),
    ).toMatchObject({
      durationSeconds: 4,
      offsetSeconds: 14,
    });
  });

  it("omits bookmarks outside the visible editor recording clips", () => {
    const recordingAsset = createEditorTestAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      durationSeconds: 20,
      id: "recording-1",
      kind: "recording",
    });
    const project = createEditorTestProject(recordingAsset, {
      tracks: [
        {
          clips: [
            createEditorTestTimelineClip(recordingAsset, {
              durationSeconds: 4,
              id: "timeline-recording",
              inSeconds: 3,
              outSeconds: 7,
              sourceOutSeconds: 20,
              startSeconds: 0,
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });

    expect(
      resolveEditorBookmarkTimelineItems({
        bookmarks: [
          createEditorTestRecordingBookmark({ id: "inside", offsetSeconds: 4 }),
          createEditorTestRecordingBookmark({
            id: "outside",
            offsetSeconds: 12,
          }),
        ],
        project,
        recordingAssetKey: recordingAsset.assetKey,
        recordingClipId: "timeline-recording",
      }).map((bookmark) => bookmark.id),
    ).toEqual(["inside"]);
  });

  it("keeps highlighted bookmark overlap visible after trimming past the bookmark point", () => {
    const recordingAsset = createEditorTestAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      durationSeconds: 30,
      id: "recording-1",
      kind: "recording",
    });
    const project = createEditorTestProject(recordingAsset, {
      tracks: [
        {
          clips: [
            createEditorTestTimelineClip(recordingAsset, {
              durationSeconds: 10,
              id: "timeline-recording",
              inSeconds: 10,
              outSeconds: 20,
              sourceOutSeconds: 30,
              startSeconds: 30,
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const bookmark = createEditorTestRecordingBookmark({
      durationSeconds: 6,
      offsetSeconds: 7,
    });

    expect(
      resolveEditorBookmarkTimelineItem({
        bookmark,
        project,
        recordingAssetKey: recordingAsset.assetKey,
        recordingClipId: "timeline-recording",
      }),
    ).toBeNull();
    expect(
      resolveEditorBookmarkTimelineHighlightItem({
        bookmark,
        project,
        recordingAssetKey: recordingAsset.assetKey,
        recordingClipId: "timeline-recording",
      }),
    ).toMatchObject({
      durationSeconds: 3,
      offsetSeconds: 30,
    });
  });

  it("keeps point-only bookmarks visible inside the trimmed clip range", () => {
    const recordingAsset = createEditorTestAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      durationSeconds: 30,
      id: "recording-1",
      kind: "recording",
    });
    const project = createEditorTestProject(recordingAsset, {
      tracks: [
        {
          clips: [
            createEditorTestTimelineClip(recordingAsset, {
              durationSeconds: 10,
              id: "timeline-recording",
              inSeconds: 10,
              outSeconds: 20,
              sourceOutSeconds: 30,
              startSeconds: 30,
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });

    expect(
      isEditorBookmarkInTimelineRange({
        bookmark: createEditorTestRecordingBookmark({
          category: "manual",
          durationSeconds: null,
          offsetSeconds: 17,
        }),
        project,
        recordingAssetKey: recordingAsset.assetKey,
        recordingClipId: "timeline-recording",
      }),
    ).toBe(true);
    expect(
      isEditorBookmarkInTimelineRange({
        bookmark: createEditorTestRecordingBookmark({
          category: "death",
          durationSeconds: null,
          offsetSeconds: 3,
        }),
        project,
        recordingAssetKey: recordingAsset.assetKey,
        recordingClipId: "timeline-recording",
      }),
    ).toBe(false);
  });

  it("maps duplicated recording bookmarks against the selected clip instance", () => {
    const recordingAsset = createEditorTestAsset({
      assetKey: "recording:recording-1",
      category: "recording",
      durationSeconds: 20,
      id: "recording-1",
      kind: "recording",
      name: "recording-1.mp4",
    });
    const project = createEditorTestProject(recordingAsset, {
      assets: [recordingAsset],
      selectedAssetKey: recordingAsset.assetKey,
      tracks: [
        {
          clips: [
            createEditorTestTimelineClip(recordingAsset, {
              durationSeconds: 8,
              id: "timeline-recording-first",
              inSeconds: 0,
              outSeconds: 8,
              sourceOutSeconds: 20,
              startSeconds: 0,
            }),
            createEditorTestTimelineClip(recordingAsset, {
              durationSeconds: 8,
              id: "timeline-recording-second",
              inSeconds: 0,
              outSeconds: 8,
              sourceOutSeconds: 20,
              startSeconds: 20,
            }),
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
    });
    const bookmark = createEditorTestRecordingBookmark({ offsetSeconds: 4 });
    const source = resolveEditorRecordingBookmarkSource({
      project,
      selectedClipId: "timeline-recording-second",
    });

    expect(source).toEqual({
      assetKey: "recording:recording-1",
      clipId: "timeline-recording-second",
      id: "recording-1",
      name: "recording-1.mp4",
    });
    expect(
      resolveEditorBookmarkTimelineSeconds({
        bookmark,
        project,
        recordingAssetKey: source?.assetKey ?? null,
        recordingClipId: source?.clipId ?? null,
      }),
    ).toBe(24);
    expect(
      resolveEditorBookmarkTimelineItems({
        bookmarks: [bookmark],
        project,
        recordingAssetKey: source?.assetKey ?? null,
        recordingClipId: source?.clipId ?? null,
      }),
    ).toMatchObject([
      {
        offsetSeconds: 24,
      },
    ]);
  });
});
