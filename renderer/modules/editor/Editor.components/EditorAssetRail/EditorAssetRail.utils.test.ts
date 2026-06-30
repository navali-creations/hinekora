import { describe, expect, it } from "vitest";

import { createEditorTestAsset } from "../../Editor.slice/Editor.slice.test-utils";
import {
  createEditorAssetRailMediaPageState,
  createEditorAssetRailMediaQuery,
  createEditorAssetRailRecentlyClippedSince,
  createEditorAssetRailSavedEditsQuery,
  createEditorAssetRailVisibleAssets,
  editorAssetRailFilterOptions,
  editorAssetRailTabOptions,
  getEditorAssetRailFilterLabel,
  getEditorAssetRailPageIndexForAssetKey,
  getEditorAssetRailTimelineAssetKeys,
  isReadyEditorAsset,
} from "./EditorAssetRail.utils";

describe("EditorAssetRail utilities", () => {
  it("creates scoped media and saved edit queries", () => {
    const scope = { game: "poe2" as const, league: "Runes of Aldur" };

    expect(
      createEditorAssetRailMediaQuery({
        mediaFilter: "death-clip",
        mediaPageIndex: 1,
        mediaRailTab: "all",
        recentlyClippedSince: "2026-06-28T11:00:00.000Z",
        scope,
        timelineAssetKeys: ["clip:used"],
      }),
    ).toEqual({
      category: "death-clip",
      excludeAssetKeys: ["clip:used"],
      game: "poe2",
      league: "Runes of Aldur",
      pageIndex: 1,
      pageSize: 5,
    });
    expect(
      createEditorAssetRailMediaQuery({
        mediaFilter: "saved-edits",
        mediaPageIndex: 0,
        mediaRailTab: "all",
        recentlyClippedSince: "2026-06-28T11:00:00.000Z",
        scope,
        timelineAssetKeys: [],
      }),
    ).toBeNull();
    expect(
      createEditorAssetRailSavedEditsQuery({
        savedEditPageIndex: 1,
        scope,
      }),
    ).toEqual({
      game: "poe2",
      league: "Runes of Aldur",
      pageIndex: 1,
      pageSize: 5,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
  });

  it("creates timeline and recently clipped media queries", () => {
    const scope = { game: "poe2" as const, league: "Runes of Aldur" };

    expect(
      createEditorAssetRailMediaQuery({
        mediaFilter: "manual-replay",
        mediaPageIndex: 0,
        mediaRailTab: "in-timeline",
        recentlyClippedSince: "2026-06-28T11:00:00.000Z",
        scope,
        timelineAssetKeys: ["clip:used"],
      }),
    ).toEqual({
      category: "manual-replay",
      game: "poe2",
      includeAssetKeys: ["clip:used"],
      pageIndex: 0,
      pageSize: 5,
    });
    expect(
      createEditorAssetRailMediaQuery({
        mediaFilter: "recording",
        mediaPageIndex: 0,
        mediaRailTab: "recently-clipped",
        recentlyClippedSince: "2026-06-28T11:00:00.000Z",
        scope,
        timelineAssetKeys: ["recording:used"],
      }),
    ).toEqual({
      category: "recording",
      createdAfter: "2026-06-28T11:00:00.000Z",
      excludeAssetKeys: ["recording:used"],
      game: "poe2",
      league: "Runes of Aldur",
      pageIndex: 0,
      pageSize: 5,
    });
  });

  it("creates recent cutoff and timeline asset keys", () => {
    expect(
      createEditorAssetRailRecentlyClippedSince(
        Date.parse("2026-06-28T12:00:00.000Z"),
      ),
    ).toBe("2026-06-28T11:00:00.000Z");
    expect(
      getEditorAssetRailTimelineAssetKeys({
        project: {
          tracks: [
            {
              clips: [
                { assetKey: "clip:first" },
                { assetKey: "clip:first" },
                { assetKey: "recording:second" },
              ],
            },
          ],
        },
      }),
    ).toEqual(["clip:first", "recording:second"]);
    expect(
      getEditorAssetRailPageIndexForAssetKey({
        assetKey: "clip:third",
        assetKeys: ["clip:first", "clip:second", "clip:third"],
        pageSize: 2,
      }),
    ).toBe(1);
    expect(
      getEditorAssetRailPageIndexForAssetKey({
        assetKey: "clip:missing",
        assetKeys: ["clip:first"],
      }),
    ).toBeNull();
  });

  it("exposes rail labels and ready asset checks", () => {
    expect(editorAssetRailFilterOptions.map((option) => option.value)).toEqual([
      "recording",
      "death-clip",
      "manual-replay",
      "saved-edits",
    ]);
    expect(editorAssetRailTabOptions.map((option) => option.value)).toEqual([
      "in-timeline",
      "recently-clipped",
      "all",
    ]);
    expect(getEditorAssetRailFilterLabel("manual-replay")).toBe(
      "Manual Replays",
    );
    expect(
      isReadyEditorAsset({
        exists: true,
        mediaUrl: "replay://clip",
        status: "ready",
      }),
    ).toBe(true);
    expect(
      isReadyEditorAsset({
        exists: true,
        mediaUrl: null,
        status: "ready",
      }),
    ).toBe(false);
  });

  it("filters visible stale media rows against the current timeline tab", () => {
    const usedAsset = createEditorTestAsset({
      assetKey: "clip:used",
      id: "used",
      name: "used.mp4",
    });
    const unusedAsset = createEditorTestAsset({
      assetKey: "clip:unused",
      id: "unused",
      name: "unused.mp4",
    });

    expect(
      createEditorAssetRailVisibleAssets({
        assets: [usedAsset, unusedAsset],
        mediaRailTab: "all",
        timelineAssetKeys: ["clip:used"],
      }).map((asset) => asset.assetKey),
    ).toEqual(["clip:unused"]);
    expect(
      createEditorAssetRailVisibleAssets({
        assets: [usedAsset, unusedAsset],
        mediaRailTab: "in-timeline",
        timelineAssetKeys: ["clip:used"],
      }).map((asset) => asset.assetKey),
    ).toEqual(["clip:used"]);
    expect(
      createEditorAssetRailVisibleAssets({
        assets: [usedAsset, unusedAsset],
        mediaRailTab: "recently-clipped",
        timelineAssetKeys: [],
      }).map((asset) => asset.assetKey),
    ).toEqual(["clip:used", "clip:unused"]);
  });

  it("filters stale rail pages for timeline key changes but does not reuse across pages", () => {
    const mediaAssetPage = {
      items: [
        createEditorTestAsset({ assetKey: "clip:used", id: "used" }),
        createEditorTestAsset({ assetKey: "clip:unused", id: "unused" }),
      ],
      pageCount: 3,
      pageIndex: 0,
      pageSize: 5,
      totalCount: 11,
    };
    const mediaAssetQuery = {
      category: "death-clip" as const,
      game: "poe2" as const,
      pageIndex: 0,
      pageSize: 5,
    };

    expect(
      createEditorAssetRailMediaPageState({
        mediaAssetPage,
        mediaAssetPendingQuery: mediaAssetQuery,
        mediaAssetQuery,
        mediaAssetsQuery: {
          ...mediaAssetQuery,
          excludeAssetKeys: ["clip:used"],
        },
        mediaFilter: "death-clip",
        mediaRailTab: "all",
        timelineAssetKeys: ["clip:used"],
      }),
    ).toMatchObject({
      currentMediaAssetPageCount: 3,
      currentMediaAssetTotalCount: 11,
      visibleAssets: [expect.objectContaining({ assetKey: "clip:unused" })],
    });
    expect(
      createEditorAssetRailMediaPageState({
        mediaAssetPage,
        mediaAssetPendingQuery: mediaAssetQuery,
        mediaAssetQuery,
        mediaAssetsQuery: {
          ...mediaAssetQuery,
          pageIndex: 1,
        },
        mediaFilter: "death-clip",
        mediaRailTab: "all",
        timelineAssetKeys: ["clip:used"],
      }),
    ).toMatchObject({
      currentMediaAssetPageCount: 1,
      currentMediaAssetTotalCount: 0,
      visibleAssets: [],
    });
  });
});
