import type { RecordingBookmark } from "~/main/modules/bookmarks";
import type {
  EditorMediaAsset,
  EditorProject,
  EditorTimelineClip,
} from "~/main/modules/editor";

interface EditorRecordingBookmarkSource {
  assetKey: string;
  clipId: string | null;
  id: string;
  name: string;
}

interface ResolveEditorRecordingBookmarkSourceInput {
  project: EditorProject | null;
  selectedClipId: string | null;
}

function resolveEditorRecordingBookmarkSource({
  project,
  selectedClipId,
}: ResolveEditorRecordingBookmarkSourceInput): EditorRecordingBookmarkSource | null {
  if (!project) {
    return null;
  }

  const assetByKey = new Map(
    project.assets.map((asset) => [asset.assetKey, asset] as const),
  );
  const clips = project.tracks.flatMap((track) => track.clips);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null;
  if (selectedClip) {
    return toEditorRecordingBookmarkSource(
      assetByKey.get(selectedClip.assetKey),
      selectedClip.id,
    );
  }

  const activeClip =
    clips.find((clip) => clip.id === project.activeClipId) ?? null;
  const activeClipAsset = activeClip
    ? assetByKey.get(activeClip.assetKey)
    : null;
  const selectedAsset = project.selectedAssetKey
    ? assetByKey.get(project.selectedAssetKey)
    : null;

  return (
    toEditorRecordingBookmarkSource(activeClipAsset, activeClip?.id ?? null) ??
    resolveSelectedAssetRecordingSource(selectedAsset, clips) ??
    resolveSingleTimelineRecordingAsset(clips, assetByKey)
  );
}

function resolveEditorBookmarkTimelineSeconds(input: {
  bookmark: RecordingBookmark;
  project: EditorProject | null;
  recordingAssetKey: string | null;
  recordingClipId: string | null;
}): number | null {
  const mapping = resolveEditorBookmarkTimelineMapping(input);

  return mapping?.timelineSeconds ?? null;
}

function resolveEditorBookmarkTimelineItem(input: {
  bookmark: RecordingBookmark;
  project: EditorProject | null;
  recordingAssetKey: string | null;
  recordingClipId: string | null;
}): RecordingBookmark | null {
  const mapping = resolveEditorBookmarkTimelineMapping(input);
  if (!mapping) {
    return null;
  }

  return {
    ...input.bookmark,
    durationSeconds: mapping.durationSeconds,
    offsetSeconds: mapping.timelineSeconds,
  };
}

function resolveEditorBookmarkTimelineHighlightItem(input: {
  bookmark: RecordingBookmark;
  project: EditorProject | null;
  recordingAssetKey: string | null;
  recordingClipId: string | null;
}): RecordingBookmark | null {
  const mapping = resolveEditorBookmarkTimelineHighlightMapping(input);
  if (!mapping) {
    return null;
  }

  return {
    ...input.bookmark,
    durationSeconds: mapping.durationSeconds,
    offsetSeconds: mapping.timelineSeconds,
  };
}

function resolveEditorBookmarkTimelineItems(input: {
  bookmarks: RecordingBookmark[];
  project: EditorProject | null;
  recordingAssetKey: string | null;
  recordingClipId: string | null;
}): RecordingBookmark[] {
  return input.bookmarks
    .map((bookmark) =>
      resolveEditorBookmarkTimelineItem({
        bookmark,
        project: input.project,
        recordingAssetKey: input.recordingAssetKey,
        recordingClipId: input.recordingClipId,
      }),
    )
    .filter((bookmark): bookmark is RecordingBookmark => bookmark !== null);
}

function isEditorBookmarkInTimelineRange(input: {
  bookmark: RecordingBookmark;
  project: EditorProject | null;
  recordingAssetKey: string | null;
  recordingClipId: string | null;
}): boolean {
  return (
    resolveEditorBookmarkTimelineMapping(input) !== null ||
    resolveEditorBookmarkTimelineHighlightMapping(input) !== null
  );
}

function resolveEditorBookmarkTimelineMapping(input: {
  bookmark: RecordingBookmark;
  project: EditorProject | null;
  recordingAssetKey: string | null;
  recordingClipId: string | null;
}): { durationSeconds: number | null; timelineSeconds: number } | null {
  if (!input.project || !input.recordingAssetKey || !input.recordingClipId) {
    return null;
  }

  const sourceSeconds = input.bookmark.offsetSeconds;
  if (
    typeof sourceSeconds !== "number" ||
    !Number.isFinite(sourceSeconds) ||
    sourceSeconds < 0
  ) {
    return null;
  }

  const clip =
    input.project.tracks
      .flatMap((track) => track.clips)
      .find(
        (timelineClip) =>
          timelineClip.id === input.recordingClipId &&
          timelineClip.assetKey === input.recordingAssetKey,
      ) ?? null;

  if (!clip) {
    return null;
  }

  const sourceStartSeconds = clip.inSeconds;
  const sourceEndSeconds = resolveClipVisibleSourceEndSeconds(clip);
  if (sourceSeconds < sourceStartSeconds || sourceSeconds > sourceEndSeconds) {
    return null;
  }

  const timelineSeconds = roundEditorBookmarkSeconds(
    clip.startSeconds +
      (sourceSeconds - sourceStartSeconds) / clip.playbackRate,
  );

  return {
    durationSeconds: resolveMappedBookmarkDurationSeconds({
      bookmark: input.bookmark,
      clip,
      sourceSeconds,
      sourceEndSeconds,
    }),
    timelineSeconds,
  };
}

function resolveEditorBookmarkTimelineHighlightMapping(input: {
  bookmark: RecordingBookmark;
  project: EditorProject | null;
  recordingAssetKey: string | null;
  recordingClipId: string | null;
}): { durationSeconds: number; timelineSeconds: number } | null {
  if (!input.project || !input.recordingAssetKey || !input.recordingClipId) {
    return null;
  }

  const sourceSeconds = input.bookmark.offsetSeconds;
  const durationSeconds = input.bookmark.durationSeconds;
  if (
    typeof sourceSeconds !== "number" ||
    !Number.isFinite(sourceSeconds) ||
    sourceSeconds < 0 ||
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  const clip =
    input.project.tracks
      .flatMap((track) => track.clips)
      .find(
        (timelineClip) =>
          timelineClip.id === input.recordingClipId &&
          timelineClip.assetKey === input.recordingAssetKey,
      ) ?? null;

  if (!clip) {
    return null;
  }

  const sourceStartSeconds = clip.inSeconds;
  const sourceEndSeconds = resolveClipVisibleSourceEndSeconds(clip);
  const bookmarkEndSeconds = sourceSeconds + durationSeconds;
  const visibleBookmarkStartSeconds = Math.max(
    sourceSeconds,
    sourceStartSeconds,
  );
  const visibleBookmarkEndSeconds = Math.min(
    bookmarkEndSeconds,
    sourceEndSeconds,
  );
  const visibleDurationSeconds = roundEditorBookmarkSeconds(
    visibleBookmarkEndSeconds - visibleBookmarkStartSeconds,
  );
  if (visibleDurationSeconds <= 0) {
    return null;
  }

  return {
    durationSeconds: roundEditorBookmarkSeconds(
      visibleDurationSeconds / clip.playbackRate,
    ),
    timelineSeconds: roundEditorBookmarkSeconds(
      clip.startSeconds +
        (visibleBookmarkStartSeconds - sourceStartSeconds) / clip.playbackRate,
    ),
  };
}

function resolveSelectedAssetRecordingSource(
  asset: EditorMediaAsset | null | undefined,
  clips: EditorTimelineClip[],
): EditorRecordingBookmarkSource | null {
  const source = toEditorRecordingBookmarkSource(asset, null);
  if (!source) {
    return null;
  }

  const matchingClips = clips.filter(
    (clip) => clip.assetKey === source.assetKey,
  );
  const [matchingClip] = matchingClips;

  return matchingClip && matchingClips.length === 1
    ? {
        ...source,
        clipId: matchingClip.id,
      }
    : null;
}

function resolveSingleTimelineRecordingAsset(
  clips: EditorTimelineClip[],
  assetByKey: Map<string, EditorMediaAsset>,
): EditorRecordingBookmarkSource | null {
  const recordingClips = clips
    .map((clip) => ({
      asset: assetByKey.get(clip.assetKey),
      clip,
    }))
    .filter(
      (entry): entry is { asset: EditorMediaAsset; clip: EditorTimelineClip } =>
        entry.asset !== undefined && entry.asset.kind === "recording",
    );

  if (recordingClips.length !== 1) {
    return null;
  }
  const [recordingClip] = recordingClips;
  if (!recordingClip) {
    return null;
  }

  return toEditorRecordingBookmarkSource(
    recordingClip.asset,
    recordingClip.clip.id,
  );
}

function toEditorRecordingBookmarkSource(
  asset: EditorMediaAsset | null | undefined,
  clipId: string | null,
): EditorRecordingBookmarkSource | null {
  if (asset?.kind !== "recording") {
    return null;
  }

  return {
    assetKey: asset.assetKey,
    clipId,
    id: asset.id,
    name: asset.name,
  };
}

function resolveClipVisibleSourceEndSeconds(clip: EditorTimelineClip): number {
  return Math.min(
    clip.outSeconds,
    clip.inSeconds + clip.durationSeconds * clip.playbackRate,
  );
}

function resolveMappedBookmarkDurationSeconds(input: {
  bookmark: RecordingBookmark;
  clip: EditorTimelineClip;
  sourceEndSeconds: number;
  sourceSeconds: number;
}): number | null {
  const durationSeconds = input.bookmark.durationSeconds;
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  const clippedEndSeconds = Math.min(
    input.sourceSeconds + durationSeconds,
    input.sourceEndSeconds,
  );
  const mappedDurationSeconds = roundEditorBookmarkSeconds(
    (clippedEndSeconds - input.sourceSeconds) / input.clip.playbackRate,
  );

  return mappedDurationSeconds > 0 ? mappedDurationSeconds : null;
}

function roundEditorBookmarkSeconds(seconds: number): number {
  return Math.round(seconds * 1_000) / 1_000;
}

export type { EditorRecordingBookmarkSource };
export {
  isEditorBookmarkInTimelineRange,
  resolveEditorBookmarkTimelineHighlightItem,
  resolveEditorBookmarkTimelineItem,
  resolveEditorBookmarkTimelineItems,
  resolveEditorBookmarkTimelineSeconds,
  resolveEditorRecordingBookmarkSource,
};
