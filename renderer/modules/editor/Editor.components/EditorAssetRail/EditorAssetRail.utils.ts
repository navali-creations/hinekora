import type {
  EditorMediaAsset,
  EditorMediaAssetPage,
  EditorMediaAssetPageQuery,
} from "~/main/modules/editor";
import type { SavedEditsLibraryQuery } from "~/main/modules/saved-edits";
import {
  ALL_LEAGUES_VALUE,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import { editorAssetRailPageSize } from "../../Editor.slice/Editor.slice.constants";
import type {
  EditorMediaFilter,
  EditorMediaRailTab,
} from "../../Editor.slice/Editor.slice.types";
import {
  canUseEditorMediaAssetPage,
  createEditorRecentlyClippedSince,
} from "../../Editor.slice/Editor.slice.utils";
import type { EditorAssetRailFilterOption } from "../EditorAssetRailFilter/EditorAssetRailFilter";

const editorAssetRailFilterOptions: Array<
  EditorAssetRailFilterOption<EditorMediaFilter>
> = [
  { label: "Recordings", value: "recording" },
  { label: "Death Clips", value: "death-clip" },
  { label: "Manual Replays", value: "manual-replay" },
  { label: "Saved Edits", value: "saved-edits" },
];

const editorAssetRailTabOptions: Array<{
  label: string;
  value: EditorMediaRailTab;
}> = [
  { label: "Timeline", value: "in-timeline" },
  { label: "Recent", value: "recently-clipped" },
  { label: "All", value: "all" },
];

function createEditorAssetRailMediaQuery(input: {
  mediaFilter: EditorMediaFilter;
  mediaPageIndex: number;
  mediaRailTab: EditorMediaRailTab;
  recentlyClippedSince: string;
  scope: MediaLibraryScope;
  timelineAssetKeys: string[];
}): EditorMediaAssetPageQuery | null {
  if (input.mediaFilter === "saved-edits") {
    return null;
  }

  return {
    category: input.mediaFilter,
    ...(input.mediaRailTab === "recently-clipped"
      ? { createdAfter: input.recentlyClippedSince }
      : {}),
    ...(input.mediaRailTab === "in-timeline"
      ? { includeAssetKeys: input.timelineAssetKeys }
      : input.timelineAssetKeys.length > 0
        ? { excludeAssetKeys: input.timelineAssetKeys }
        : {}),
    game: input.scope.game,
    ...(input.mediaRailTab === "in-timeline" ||
    input.scope.league === ALL_LEAGUES_VALUE
      ? {}
      : { league: input.scope.league }),
    pageIndex: input.mediaPageIndex,
    pageSize: editorAssetRailPageSize,
  };
}

function createEditorAssetRailRecentlyClippedSince(nowMs = Date.now()): string {
  return createEditorRecentlyClippedSince(nowMs);
}

function getEditorAssetRailTimelineAssetKeys(input: {
  project: {
    tracks: Array<{ clips: Array<{ assetKey: string }> }>;
  } | null;
}): string[] {
  const seenAssetKeys = new Set<string>();
  const assetKeys: string[] = [];

  for (const track of input.project?.tracks ?? []) {
    for (const clip of track.clips) {
      if (seenAssetKeys.has(clip.assetKey)) {
        continue;
      }

      seenAssetKeys.add(clip.assetKey);
      assetKeys.push(clip.assetKey);
    }
  }

  return assetKeys;
}

function getEditorAssetRailPageIndexForAssetKey(input: {
  assetKey: string | null;
  assetKeys: string[];
  pageSize?: number;
}): number | null {
  if (!input.assetKey) {
    return null;
  }

  const assetIndex = input.assetKeys.indexOf(input.assetKey);
  if (assetIndex < 0) {
    return null;
  }

  return Math.floor(assetIndex / (input.pageSize ?? editorAssetRailPageSize));
}

function createEditorAssetRailVisibleAssets(input: {
  assets: EditorMediaAsset[];
  mediaRailTab: EditorMediaRailTab;
  timelineAssetKeys: string[];
}): EditorMediaAsset[] {
  if (input.timelineAssetKeys.length === 0) {
    return input.mediaRailTab === "in-timeline" ? [] : input.assets;
  }

  const timelineAssetKeySet = new Set(input.timelineAssetKeys);

  if (input.mediaRailTab === "in-timeline") {
    return input.assets.filter((asset) =>
      timelineAssetKeySet.has(asset.assetKey),
    );
  }

  return input.assets.filter(
    (asset) => !timelineAssetKeySet.has(asset.assetKey),
  );
}

function createEditorAssetRailMediaPageState(input: {
  mediaAssetPage: EditorMediaAssetPage | null;
  mediaAssetPendingQuery: EditorMediaAssetPageQuery | null;
  mediaAssetQuery: EditorMediaAssetPageQuery | null;
  mediaAssetsQuery: EditorMediaAssetPageQuery | null;
  mediaFilter: EditorMediaFilter;
  mediaRailTab: EditorMediaRailTab;
  timelineAssetKeys: string[];
}) {
  const hasCurrentMediaAssetPage =
    input.mediaAssetsQuery !== null &&
    input.mediaAssetQuery !== null &&
    canUseEditorMediaAssetPage(input.mediaAssetsQuery, input.mediaAssetQuery);
  const canShowMediaAssetPage =
    hasCurrentMediaAssetPage ||
    canReuseEditorAssetRailStaleMediaPage({
      mediaAssetQuery: input.mediaAssetQuery,
      mediaAssetsQuery: input.mediaAssetsQuery,
    });
  const visibleAssets =
    input.mediaFilter === "saved-edits" ||
    !input.mediaAssetPage ||
    !canShowMediaAssetPage
      ? []
      : createEditorAssetRailVisibleAssets({
          assets: input.mediaAssetPage.items,
          mediaRailTab: input.mediaRailTab,
          timelineAssetKeys: input.timelineAssetKeys,
        });

  return {
    currentMediaAssetPageCount: canShowMediaAssetPage
      ? (input.mediaAssetPage?.pageCount ?? 1)
      : 1,
    currentMediaAssetTotalCount: canShowMediaAssetPage
      ? (input.mediaAssetPage?.totalCount ?? 0)
      : 0,
    shouldShowMediaEmptyState:
      hasCurrentMediaAssetPage &&
      (input.mediaAssetPage?.totalCount ?? 0) === 0 &&
      input.mediaAssetPendingQuery === null,
    visibleAssets,
  };
}

function canReuseEditorAssetRailStaleMediaPage(input: {
  mediaAssetQuery: EditorMediaAssetPageQuery | null;
  mediaAssetsQuery: EditorMediaAssetPageQuery | null;
}): boolean {
  if (!input.mediaAssetQuery || !input.mediaAssetsQuery) {
    return false;
  }

  return (
    input.mediaAssetQuery.category === input.mediaAssetsQuery.category &&
    input.mediaAssetQuery.createdAfter ===
      input.mediaAssetsQuery.createdAfter &&
    input.mediaAssetQuery.game === input.mediaAssetsQuery.game &&
    input.mediaAssetQuery.league === input.mediaAssetsQuery.league &&
    (input.mediaAssetQuery.pageIndex ?? 0) ===
      (input.mediaAssetsQuery.pageIndex ?? 0) &&
    input.mediaAssetQuery.pageSize === input.mediaAssetsQuery.pageSize
  );
}

function getEditorAssetRailFilterLabel(filter: EditorMediaFilter): string {
  return (
    editorAssetRailFilterOptions.find((option) => option.value === filter)
      ?.label ?? "media"
  );
}

function createEditorAssetRailSavedEditsQuery(input: {
  savedEditPageIndex: number;
  scope: MediaLibraryScope;
}): SavedEditsLibraryQuery {
  return {
    game: input.scope.game,
    ...(input.scope.league === ALL_LEAGUES_VALUE
      ? {}
      : { league: input.scope.league }),
    pageIndex: input.savedEditPageIndex,
    pageSize: editorAssetRailPageSize,
    sortBy: "updatedAt",
    sortDirection: "desc",
  };
}

function isReadyEditorAsset(asset: {
  exists: boolean;
  mediaUrl: string | null;
  status: string;
}): boolean {
  return asset.exists && asset.status === "ready" && asset.mediaUrl !== null;
}

async function revealEditorAssetFolder(asset: EditorMediaAsset): Promise<void> {
  if (asset.kind === "clip") {
    await window.electron.replayClips.reveal(asset.id);
    return;
  }

  const detail = await window.electron.recordingStorage.getRecording(asset.id);
  if (detail) {
    await window.electron.recordingStorage.revealRecording(
      detail.recording.path,
    );
  }
}

export {
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
  revealEditorAssetFolder,
};
