import {
  assertNumber,
  assertObject,
  assertString,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import type { GameId } from "~/types";
import { EditorChannel } from "./Editor.channels";
import type {
  EditorCopyToClipboardInput,
  EditorCreateProjectInput,
  EditorExportClipInput,
  EditorExportInput,
  EditorExportMode,
  EditorExportResolution,
  EditorMediaAsset,
  EditorMediaKind,
  EditorMediaReference,
  EditorProject,
  EditorSaveProjectInput,
  EditorTimelineClip,
  EditorTimelineTrack,
  EditorWorkspaceQuery,
} from "./Editor.dto";
import { validateEditorExportTimeline } from "./Editor.export";

const maxEditorAssetKeys = 100;
const maxEditorAssets = 100;
const maxEditorProjectListLimit = 100;
const maxEditorExportDurationSeconds = 4 * 60 * 60;
const maxEditorExportClips = 200;
const maxEditorProjectTracks = 8;
const editorTimelineEpsilonSeconds = 0.001;
const editorMediaKinds: EditorMediaKind[] = ["clip", "recording"];
const editorExportModes: EditorExportMode[] = ["overwrite", "new-file"];
const editorExportResolutions: EditorExportResolution[] = ["720p", "1080p"];

function validateEditorWorkspaceQuery(value: unknown): EditorWorkspaceQuery {
  if (value === undefined) {
    return {};
  }

  assertObject(value, "editor workspace query", EditorChannel.GetWorkspace);

  const query: EditorWorkspaceQuery = {};
  if (value.projectLimit !== undefined && value.projectLimit !== null) {
    assertNumber(
      value.projectLimit,
      "project limit",
      EditorChannel.GetWorkspace,
      {
        integer: true,
        max: maxEditorProjectListLimit,
        min: 1,
      },
    );
    query.projectLimit = value.projectLimit;
  }
  if (value.projectId !== undefined && value.projectId !== null) {
    assertString(value.projectId, "project id", EditorChannel.GetWorkspace, {
      min: 1,
      max: 128,
    });
    query.projectId = value.projectId;
  }
  if (value.source !== undefined && value.source !== null) {
    query.source = validateEditorMediaReference(
      value.source,
      EditorChannel.GetWorkspace,
    );
  }

  return query;
}

function validateEditorCreateProjectInput(
  value: unknown,
): EditorCreateProjectInput {
  if (value === undefined) {
    return {};
  }

  assertObject(value, "editor project input", EditorChannel.CreateProject);

  const input: EditorCreateProjectInput = {};
  if (value.source !== undefined && value.source !== null) {
    input.source = validateEditorMediaReference(
      value.source,
      EditorChannel.CreateProject,
    );
  }
  if (value.assetKeys !== undefined) {
    input.assetKeys = validateEditorAssetKeys(value.assetKeys);
  }
  if (value.title !== undefined) {
    assertString(value.title, "title", EditorChannel.CreateProject, {
      min: 1,
      max: 120,
    });
    input.title = value.title;
  }

  return input;
}

function validateEditorSaveProjectInput(
  value: unknown,
): EditorSaveProjectInput {
  assertObject(value, "editor project save input", EditorChannel.SaveProject);

  return {
    project: validateEditorProject(value.project, EditorChannel.SaveProject),
  };
}

function validateEditorExportInput(value: unknown): EditorExportInput {
  assertObject(value, "editor export input", EditorChannel.ExportProject);
  assertString(value.fileName, "file name", EditorChannel.ExportProject, {
    min: 1,
    max: 180,
  });
  assertString(
    value.exportRequestId,
    "export request id",
    EditorChannel.ExportProject,
    {
      min: 1,
      max: 128,
    },
  );
  assertString(value.mode, "export mode", EditorChannel.ExportProject, {
    min: 1,
    max: 24,
  });
  if (!editorExportModes.includes(value.mode as EditorExportMode)) {
    throw new IpcValidationError(
      EditorChannel.ExportProject,
      "export mode is invalid",
    );
  }
  assertString(
    value.resolution,
    "export resolution",
    EditorChannel.ExportProject,
    {
      min: 1,
      max: 16,
    },
  );
  if (
    !editorExportResolutions.includes(
      value.resolution as EditorExportResolution,
    )
  ) {
    throw new IpcValidationError(
      EditorChannel.ExportProject,
      "export resolution is invalid",
    );
  }
  assertNumber(value.durationSeconds, "duration", EditorChannel.ExportProject, {
    min: 0,
    max: 86_400,
  });
  const clips = validateEditorExportClips(
    value.clips,
    EditorChannel.ExportProject,
  );
  validateTimelinePayload({
    channel: EditorChannel.ExportProject,
    clips,
    timelineDurationSeconds: value.durationSeconds,
  });
  const mode = value.mode as EditorExportMode;
  const overwriteSource =
    mode === "overwrite"
      ? validateEditorMediaReference(
          value.overwriteSource,
          EditorChannel.ExportProject,
        )
      : null;
  if (
    overwriteSource &&
    !clips.some((clip) =>
      isEditorMediaReferenceEqual(clip.source, overwriteSource),
    )
  ) {
    throw new IpcValidationError(
      EditorChannel.ExportProject,
      "overwrite source must be included in clips",
    );
  }

  return {
    clips,
    durationSeconds: value.durationSeconds,
    exportRequestId: value.exportRequestId,
    fileName: value.fileName,
    mode,
    overwriteSource,
    resolution: value.resolution as EditorExportResolution,
  };
}

function validateEditorCopyToClipboardInput(
  value: unknown,
): EditorCopyToClipboardInput {
  assertObject(
    value,
    "editor clipboard input",
    EditorChannel.CopyProjectToClipboard,
  );
  assertString(
    value.fileName,
    "file name",
    EditorChannel.CopyProjectToClipboard,
    {
      min: 1,
      max: 180,
    },
  );
  assertString(
    value.resolution,
    "export resolution",
    EditorChannel.CopyProjectToClipboard,
    {
      min: 1,
      max: 16,
    },
  );
  if (
    !editorExportResolutions.includes(
      value.resolution as EditorExportResolution,
    )
  ) {
    throw new IpcValidationError(
      EditorChannel.CopyProjectToClipboard,
      "export resolution is invalid",
    );
  }
  assertNumber(
    value.durationSeconds,
    "duration",
    EditorChannel.CopyProjectToClipboard,
    {
      min: 0,
      max: 86_400,
    },
  );
  const clips = validateEditorExportClips(
    value.clips,
    EditorChannel.CopyProjectToClipboard,
  );
  validateTimelinePayload({
    channel: EditorChannel.CopyProjectToClipboard,
    clips,
    timelineDurationSeconds: value.durationSeconds,
  });

  return {
    clips,
    durationSeconds: value.durationSeconds,
    fileName: value.fileName,
    resolution: value.resolution as EditorExportResolution,
  };
}

function validateEditorProject(
  value: unknown,
  channel: EditorChannel,
): EditorProject {
  assertObject(value, "editor project", channel);
  assertString(value.id, "project id", channel, { min: 1, max: 128 });
  assertString(value.title, "project title", channel, { min: 1, max: 120 });
  assertString(value.createdAt, "project created at", channel, {
    min: 1,
    max: 64,
  });
  assertString(value.updatedAt, "project updated at", channel, {
    min: 1,
    max: 64,
  });
  assertNumber(value.durationSeconds, "project duration", channel, {
    min: 0,
    max: 86_400,
  });
  const assets = validateEditorProjectAssets(value.assets, channel);
  const tracks = validateEditorProjectTracks(value.tracks, channel);
  const activeClipId =
    value.activeClipId === null
      ? null
      : validateNullableProjectString(
          value.activeClipId,
          "active clip id",
          channel,
        );
  const selectedAssetKey =
    value.selectedAssetKey === null
      ? null
      : validateNullableProjectString(
          value.selectedAssetKey,
          "selected asset key",
          channel,
        );

  const project = {
    activeClipId,
    assets,
    createdAt: value.createdAt,
    durationSeconds: value.durationSeconds,
    id: value.id,
    selectedAssetKey,
    title: value.title,
    tracks,
    updatedAt: value.updatedAt,
  };
  validateEditorProjectSemantics(project, channel);

  return project;
}

function validateEditorProjectSemantics(
  project: EditorProject,
  channel: EditorChannel,
): void {
  const assetByKey = new Map(
    project.assets.map((asset) => [asset.assetKey, asset] as const),
  );
  if (assetByKey.size !== project.assets.length) {
    throw new IpcValidationError(channel, "asset keys must be unique");
  }

  const clipIds = new Set<string>();
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clipIds.has(clip.id)) {
        throw new IpcValidationError(channel, "clip ids must be unique");
      }
      clipIds.add(clip.id);

      if (clip.trackId !== track.id) {
        throw new IpcValidationError(
          channel,
          "clip track id must match parent track",
        );
      }

      const asset = assetByKey.get(clip.assetKey);
      if (!asset) {
        throw new IpcValidationError(
          channel,
          "clip asset must exist in project assets",
        );
      }

      if (
        asset.durationSeconds !== null &&
        clip.outSeconds > asset.durationSeconds + editorTimelineEpsilonSeconds
      ) {
        throw new IpcValidationError(
          channel,
          "clip out point must fit asset duration",
        );
      }

      if (
        clip.durationSeconds >
        clip.outSeconds - clip.inSeconds + editorTimelineEpsilonSeconds
      ) {
        throw new IpcValidationError(
          channel,
          "clip duration must fit source range",
        );
      }

      if (
        clip.startSeconds + clip.durationSeconds >
        project.durationSeconds + editorTimelineEpsilonSeconds
      ) {
        throw new IpcValidationError(
          channel,
          "clip range must fit project duration",
        );
      }
    }
  }

  if (project.activeClipId !== null && !clipIds.has(project.activeClipId)) {
    throw new IpcValidationError(
      channel,
      "active clip id must match a timeline clip",
    );
  }

  if (
    project.selectedAssetKey !== null &&
    !assetByKey.has(project.selectedAssetKey)
  ) {
    throw new IpcValidationError(
      channel,
      "selected asset key must exist in project assets",
    );
  }
}

function validateEditorProjectAssets(
  value: unknown,
  channel: EditorChannel,
): EditorMediaAsset[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(channel, "assets must be an array");
  }
  if (value.length > maxEditorAssets) {
    throw new IpcValidationError(channel, "assets is too large");
  }

  return value.map((asset) => validateEditorProjectAsset(asset, channel));
}

function validateEditorProjectAsset(
  value: unknown,
  channel: EditorChannel,
): EditorMediaAsset {
  assertObject(value, "asset", channel);
  assertString(value.assetKey, "asset key", channel, { min: 1, max: 2_080 });
  assertString(value.category, "asset category", channel, { min: 1, max: 32 });
  if (
    value.category !== "death-clip" &&
    value.category !== "manual-replay" &&
    value.category !== "recording"
  ) {
    throw new IpcValidationError(channel, "asset category is invalid");
  }
  assertString(value.createdAt, "asset created at", channel, {
    min: 1,
    max: 64,
  });
  assertString(value.id, "asset id", channel, { min: 1, max: 2_048 });
  assertString(value.kind, "asset kind", channel, { min: 1, max: 16 });
  if (!editorMediaKinds.includes(value.kind as EditorMediaKind)) {
    throw new IpcValidationError(channel, "asset kind is invalid");
  }
  assertString(value.name, "asset name", channel, { min: 1, max: 260 });
  assertNumber(value.sizeBytes, "asset size", channel, { min: 0, max: 1e15 });
  assertString(value.sourceGame, "asset source game", channel, {
    min: 1,
    max: 16,
  });
  if (value.sourceGame !== "poe1" && value.sourceGame !== "poe2") {
    throw new IpcValidationError(channel, "asset source game is invalid");
  }
  assertString(value.sourceLeague, "asset source league", channel, {
    min: 1,
    max: 120,
  });
  assertString(value.status, "asset status", channel, { min: 1, max: 32 });
  if (
    value.status !== "ready" &&
    value.status !== "missing" &&
    value.status !== "processing" &&
    value.status !== "failed"
  ) {
    throw new IpcValidationError(channel, "asset status is invalid");
  }
  assertString(value.subtitle, "asset subtitle", channel, { min: 1, max: 260 });

  return {
    assetKey: value.assetKey,
    category: value.category,
    createdAt: value.createdAt,
    durationSeconds:
      value.durationSeconds === null
        ? null
        : validateProjectNumber(
            value.durationSeconds,
            "asset duration",
            channel,
          ),
    exists: Boolean(value.exists),
    id: value.id,
    kind: value.kind as EditorMediaKind,
    mediaUrl:
      value.mediaUrl === null
        ? null
        : validateNullableProjectString(
            value.mediaUrl,
            "asset media URL",
            channel,
          ),
    name: value.name,
    sizeBytes: value.sizeBytes,
    sourceGame: value.sourceGame as GameId,
    sourceLeague: value.sourceLeague,
    status: value.status,
    subtitle: value.subtitle,
  };
}

function validateEditorProjectTracks(
  value: unknown,
  channel: EditorChannel,
): EditorTimelineTrack[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(channel, "tracks must be an array");
  }
  if (value.length > maxEditorProjectTracks) {
    throw new IpcValidationError(channel, "tracks is too large");
  }

  return value.map((track) => validateEditorProjectTrack(track, channel));
}

function validateEditorProjectTrack(
  value: unknown,
  channel: EditorChannel,
): EditorTimelineTrack {
  assertObject(value, "track", channel);
  assertString(value.id, "track id", channel, { min: 1, max: 128 });
  assertString(value.kind, "track kind", channel, { min: 1, max: 24 });
  if (value.kind !== "video") {
    throw new IpcValidationError(channel, "track kind is invalid");
  }
  assertString(value.label, "track label", channel, { min: 1, max: 80 });
  if (!Array.isArray(value.clips)) {
    throw new IpcValidationError(channel, "clips must be an array");
  }
  if (value.clips.length > maxEditorExportClips) {
    throw new IpcValidationError(channel, "clips is too large");
  }

  return {
    clips: value.clips.map((clip) => validateEditorProjectClip(clip, channel)),
    id: value.id,
    kind: "video",
    label: value.label,
  };
}

function validateEditorProjectClip(
  value: unknown,
  channel: EditorChannel,
): EditorTimelineClip {
  assertObject(value, "clip", channel);
  assertString(value.assetKey, "clip asset key", channel, {
    min: 1,
    max: 2_080,
  });
  assertString(value.color, "clip color", channel, { min: 1, max: 24 });
  if (
    value.color !== "primary" &&
    value.color !== "secondary" &&
    value.color !== "accent"
  ) {
    throw new IpcValidationError(channel, "clip color is invalid");
  }
  assertString(value.id, "clip id", channel, { min: 1, max: 256 });
  assertString(value.name, "clip name", channel, { min: 1, max: 260 });
  assertString(value.trackId, "clip track id", channel, { min: 1, max: 128 });
  assertNumber(value.durationSeconds, "clip duration", channel, {
    min: 0.001,
    max: 86_400,
  });
  assertNumber(value.inSeconds, "clip in point", channel, {
    min: 0,
    max: 86_400,
  });
  assertNumber(value.outSeconds, "clip out point", channel, {
    min: 0,
    max: 86_400,
  });
  assertNumber(value.startSeconds, "clip start", channel, {
    min: 0,
    max: 86_400,
  });
  if (value.outSeconds <= value.inSeconds) {
    throw new IpcValidationError(
      channel,
      "clip out point must be after clip in point",
    );
  }

  return {
    assetKey: value.assetKey,
    color: value.color,
    durationSeconds: value.durationSeconds,
    id: value.id,
    inSeconds: value.inSeconds,
    mediaUrl:
      value.mediaUrl === null
        ? null
        : validateNullableProjectString(
            value.mediaUrl,
            "clip media URL",
            channel,
          ),
    name: value.name,
    outSeconds: value.outSeconds,
    ...(value.sourceInSeconds === undefined
      ? {}
      : {
          sourceInSeconds: validateProjectNumber(
            value.sourceInSeconds,
            "clip source in point",
            channel,
          ),
        }),
    ...(value.sourceOutSeconds === undefined
      ? {}
      : {
          sourceOutSeconds: validateProjectNumber(
            value.sourceOutSeconds,
            "clip source out point",
            channel,
          ),
        }),
    startSeconds: value.startSeconds,
    trackId: value.trackId,
  };
}

function validateNullableProjectString(
  value: unknown,
  label: string,
  channel: EditorChannel,
): string {
  assertString(value, label, channel, { min: 1, max: 2_080 });

  return value;
}

function validateProjectNumber(
  value: unknown,
  label: string,
  channel: EditorChannel,
): number {
  assertNumber(value, label, channel, { min: 0, max: 86_400 });

  return value;
}

function validateEditorExportClips(
  value: unknown,
  channel: EditorChannel,
): EditorExportClipInput[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(channel, "clips must be an array");
  }
  if (value.length > maxEditorExportClips) {
    throw new IpcValidationError(channel, "clips is too large");
  }
  const clips = value.map((clip) => validateEditorExportClip(clip, channel));
  if (clips.length === 0) {
    throw new IpcValidationError(channel, "clips is too short");
  }

  return clips;
}

function validateEditorExportClip(
  value: unknown,
  channel: EditorChannel,
): EditorExportClipInput {
  assertObject(value, "clip", channel);
  assertNumber(value.startSeconds, "clip start", channel, {
    min: 0,
    max: 86_400,
  });
  assertNumber(value.inSeconds, "clip in point", channel, {
    min: 0,
    max: 86_400,
  });
  assertNumber(value.outSeconds, "clip out point", channel, {
    min: 0,
    max: 86_400,
  });
  assertNumber(value.durationSeconds, "clip duration", channel, {
    min: 0.001,
    max: 86_400,
  });
  if (value.outSeconds <= value.inSeconds) {
    throw new IpcValidationError(
      channel,
      "clip out point must be after clip in point",
    );
  }

  return {
    durationSeconds: value.durationSeconds,
    inSeconds: value.inSeconds,
    outSeconds: value.outSeconds,
    source: validateEditorMediaReference(value.source, channel),
    startSeconds: value.startSeconds,
  };
}

function validateEditorMediaReference(
  value: unknown,
  channel: EditorChannel,
): EditorMediaReference {
  assertObject(value, "media reference", channel);
  assertString(value.kind, "media kind", channel, { min: 1, max: 16 });
  if (!editorMediaKinds.includes(value.kind as EditorMediaKind)) {
    throw new IpcValidationError(channel, "media kind is invalid");
  }
  assertString(value.id, "media id", channel, { min: 1, max: 2_048 });

  return {
    id: value.id,
    kind: value.kind as EditorMediaKind,
  };
}

function isEditorMediaReferenceEqual(
  first: EditorMediaReference,
  second: EditorMediaReference,
): boolean {
  return first.id === second.id && first.kind === second.kind;
}

function validateTimelinePayload(input: {
  channel: EditorChannel;
  clips: EditorExportClipInput[];
  timelineDurationSeconds: number;
}): void {
  const error = validateEditorExportTimeline({
    clips: input.clips,
    maxDurationSeconds: maxEditorExportDurationSeconds,
    timelineDurationSeconds: input.timelineDurationSeconds,
  });
  if (error) {
    throw new IpcValidationError(input.channel, error);
  }
}

function validateEditorAssetKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(
      EditorChannel.CreateProject,
      "asset keys must be an array",
    );
  }
  if (value.length > maxEditorAssetKeys) {
    throw new IpcValidationError(
      EditorChannel.CreateProject,
      "asset keys is too large",
    );
  }

  return value.map((assetKey) => {
    assertString(assetKey, "asset key", EditorChannel.CreateProject, {
      min: 1,
      max: 2_080,
    });

    return assetKey;
  });
}

export {
  validateEditorCopyToClipboardInput,
  validateEditorCreateProjectInput,
  validateEditorExportInput,
  validateEditorSaveProjectInput,
  validateEditorWorkspaceQuery,
};
