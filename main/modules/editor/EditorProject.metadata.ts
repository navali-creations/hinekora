import type { GameId } from "~/types";
import type { EditorProject } from "./Editor.dto";

interface EditorProjectPersistedMetadata {
  historyEditCount: number;
  sourceLeagueMemberships: EditorProjectSourceLeagueMembership[];
  sourceGame: GameId | null;
  sourceLeague: string | null;
  sourceSizeBytes: number;
}

interface EditorProjectSourceLeagueMembership {
  sourceGame: GameId;
  sourceLeague: string;
}

const maxEditorProjectPersistedHistoryLabels = 50;

function createEditorProjectPersistedMetadata(
  project: EditorProject,
): EditorProjectPersistedMetadata {
  const historyLabels = (project.history?.labels ?? [])
    .filter((label) => label.trim().length > 0)
    .slice(-maxEditorProjectPersistedHistoryLabels);
  const timelineAssets = resolveEditorProjectTimelineAssets(project);
  const sourceGame = resolveCommonTimelineAssetValue(
    timelineAssets.map((asset) => asset.sourceGame),
  );
  const sourceLeague = resolveCommonTimelineAssetValue(
    timelineAssets.map((asset) => asset.sourceLeague),
  );
  const sourceLeagueMemberships =
    resolveEditorProjectSourceLeagueMemberships(timelineAssets);
  const sizeByAssetKey = new Map<string, number>();
  for (const asset of timelineAssets) {
    const currentSize = sizeByAssetKey.get(asset.assetKey) ?? 0;
    sizeByAssetKey.set(asset.assetKey, Math.max(currentSize, asset.sizeBytes));
  }

  return {
    historyEditCount: Math.min(
      maxEditorProjectPersistedHistoryLabels,
      Math.max(project.history?.editCount ?? 0, historyLabels.length),
    ),
    sourceGame,
    sourceLeagueMemberships,
    sourceLeague,
    sourceSizeBytes: Array.from(sizeByAssetKey.values()).reduce(
      (totalSize, sizeBytes) => totalSize + sizeBytes,
      0,
    ),
  };
}

function resolveEditorProjectTimelineAssets(
  project: EditorProject,
): EditorProject["assets"] {
  const assetByKey = new Map(
    project.assets.map((asset) => [asset.assetKey, asset] as const),
  );
  const timelineAssets: EditorProject["assets"] = [];
  const seenAssetKeys = new Set<string>();

  for (const clip of project.tracks.flatMap((track) => track.clips)) {
    if (seenAssetKeys.has(clip.assetKey)) {
      continue;
    }
    seenAssetKeys.add(clip.assetKey);

    const asset = assetByKey.get(clip.assetKey);
    if (asset) {
      timelineAssets.push(asset);
    }
  }

  return timelineAssets;
}

function resolveCommonTimelineAssetValue<TValue extends string>(
  values: TValue[],
): TValue | null {
  const firstValue = values[0];
  if (!firstValue) {
    return null;
  }

  return values.every((value) => value === firstValue) ? firstValue : null;
}

function resolveEditorProjectSourceLeagueMemberships(
  timelineAssets: EditorProject["assets"],
): EditorProjectSourceLeagueMembership[] {
  const membershipByKey = new Map<
    string,
    EditorProjectSourceLeagueMembership
  >();
  for (const asset of timelineAssets) {
    const membership = {
      sourceGame: asset.sourceGame,
      sourceLeague: asset.sourceLeague,
    };
    membershipByKey.set(
      `${membership.sourceGame}:${membership.sourceLeague}`,
      membership,
    );
  }

  return Array.from(membershipByKey.values()).sort((first, second) => {
    const gameComparison = first.sourceGame.localeCompare(second.sourceGame);
    if (gameComparison !== 0) {
      return gameComparison;
    }

    return first.sourceLeague.localeCompare(second.sourceLeague);
  });
}

export type {
  EditorProjectPersistedMetadata,
  EditorProjectSourceLeagueMembership,
};
export {
  createEditorProjectPersistedMetadata,
  resolveEditorProjectTimelineAssets,
};
