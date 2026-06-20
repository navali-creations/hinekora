import { describe, expect, it } from "vitest";

import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import type { ReplayClipDetail } from "~/main/modules/replay-clips";

import {
  createEditorAssetFromRecording,
  createEditorAssetFromReplayClip,
  createEditorProjectFromAssets,
  normalizeAssetDuration,
  sortEditorAssets,
} from "../Editor.mapper";

describe("Editor mapper", () => {
  it("maps replay clips and recordings into editor assets", () => {
    const clipDetail: ReplayClipDetail = {
      mediaUrl: "hinekora-media://replay-clip/clip-1",
      clip: {
        id: "clip-1",
        kind: "manual",
        status: "ready",
        sourceGame: "poe2",
        sourceLeague: "Standard",
        deathTimestamp: "2026-06-12T10:00:00.000Z",
        triggerLineHash: "hash",
        originalObsPath: "C:\\Videos\\manual.mp4",
        processedClipPath: "C:\\Videos\\manual.mp4",
        targetDurationSeconds: 12,
        sizeBytes: 1024,
        error: null,
        createdAt: "2026-06-12T10:01:00.000Z",
        updatedAt: "2026-06-12T10:01:00.000Z",
      },
    };
    const recordingDetail: RunRecordingDetail = {
      mediaUrl: null,
      recording: {
        id: "recording-1",
        path: "C:\\Videos\\2026-06-12_10-30-00.mp4",
        fileName: "2026-06-12_10-30-00.mp4",
        sourceGame: "poe1",
        sourceLeague: "Hardcore",
        startedAt: "2026-06-12T10:00:00.000Z",
        stoppedAt: "2026-06-12T10:30:00.000Z",
        createdAt: "2026-06-12T10:30:00.000Z",
        updatedAt: "2026-06-12T10:30:00.000Z",
        durationSeconds: 1800,
        sizeBytes: 2048,
        exists: false,
      },
    };

    expect(createEditorAssetFromReplayClip(clipDetail)).toMatchObject({
      assetKey: "clip:clip-1",
      category: "manual-replay",
      durationSeconds: 12,
      exists: true,
      kind: "clip",
      name: "manual.mp4",
      status: "ready",
      subtitle: "Manual replay - Standard",
    });
    expect(createEditorAssetFromRecording(recordingDetail)).toMatchObject({
      assetKey: "recording:recording-1",
      category: "recording",
      exists: false,
      kind: "recording",
      status: "missing",
      subtitle: "Run recording - Hardcore",
    });
  });

  it("maps replay status fallbacks and clip labels", () => {
    const failedClip: ReplayClipDetail = {
      mediaUrl: null,
      clip: {
        id: "clip-2",
        kind: "death",
        status: "failed",
        sourceGame: "poe1",
        sourceLeague: "Hardcore",
        deathTimestamp: "2026-06-12T10:00:00.000Z",
        triggerLineHash: "hash",
        originalObsPath: "",
        processedClipPath: null,
        targetDurationSeconds: 10,
        sizeBytes: 0,
        error: "failed",
        createdAt: "2026-06-12T10:01:00.000Z",
        updatedAt: "2026-06-12T10:01:00.000Z",
      },
    };
    const processingClip: ReplayClipDetail = {
      ...failedClip,
      clip: {
        ...failedClip.clip,
        id: "clip-3",
        status: "processing",
      },
    };
    const missingReadyClip: ReplayClipDetail = {
      ...failedClip,
      clip: {
        ...failedClip.clip,
        id: "clip-4",
        status: "ready",
      },
    };

    expect(createEditorAssetFromReplayClip(failedClip)).toMatchObject({
      category: "death-clip",
      exists: false,
      name: "Death clip",
      status: "failed",
      subtitle: "Death clip - Hardcore",
    });
    expect(createEditorAssetFromReplayClip(processingClip)).toMatchObject({
      status: "processing",
    });
    expect(createEditorAssetFromReplayClip(missingReadyClip)).toMatchObject({
      status: "missing",
    });
  });

  it("builds a sequential editor project timeline", () => {
    const assets = [
      {
        assetKey: "clip:a",
        category: "death-clip" as const,
        createdAt: "2026-06-12T10:00:00.000Z",
        durationSeconds: 5,
        exists: true,
        id: "a",
        kind: "clip" as const,
        mediaUrl: "hinekora-media://replay-clip/a",
        name: "a.mp4",
        sizeBytes: 1,
        sourceGame: "poe1" as const,
        sourceLeague: "Standard",
        status: "ready" as const,
        subtitle: "Death clip - Standard",
      },
      {
        assetKey: "recording:b",
        category: "recording" as const,
        createdAt: "2026-06-12T10:01:00.000Z",
        durationSeconds: null,
        exists: true,
        id: "b",
        kind: "recording" as const,
        mediaUrl: "hinekora-media://run-recording/b",
        name: "b.mp4",
        sizeBytes: 1,
        sourceGame: "poe1" as const,
        sourceLeague: "Standard",
        status: "ready" as const,
        subtitle: "Run recording - Standard",
      },
    ];

    const project = createEditorProjectFromAssets({
      assets,
      id: "project-1",
      now: "2026-06-12T10:02:00.000Z",
    });

    expect(project).toMatchObject({
      activeClipId: "timeline-1-clip:a",
      durationSeconds: 15,
      selectedAssetKey: "clip:a",
      title: "2 asset edit",
    });
    expect(project.tracks[0]?.clips).toEqual([
      expect.objectContaining({
        assetKey: "clip:a",
        durationSeconds: 5,
        sourceInSeconds: 0,
        sourceOutSeconds: 5,
        startSeconds: 0,
      }),
      expect.objectContaining({
        assetKey: "recording:b",
        durationSeconds: 10,
        sourceInSeconds: 0,
        sourceOutSeconds: 10,
        startSeconds: 5,
      }),
    ]);
  });

  it("normalizes durations and sorts assets by newest first", () => {
    expect(normalizeAssetDuration(null)).toBe(10);
    expect(normalizeAssetDuration(-1)).toBe(10);
    expect(normalizeAssetDuration(1.4)).toBe(1.4);

    const sorted = sortEditorAssets([
      {
        assetKey: "clip:a",
        category: "death-clip",
        createdAt: "2026-06-12T10:00:00.000Z",
        durationSeconds: 5,
        exists: true,
        id: "a",
        kind: "clip",
        mediaUrl: null,
        name: "z.mp4",
        sizeBytes: 1,
        sourceGame: "poe1",
        sourceLeague: "Standard",
        status: "ready",
        subtitle: "Death clip - Standard",
      },
      {
        assetKey: "clip:b",
        category: "death-clip",
        createdAt: "2026-06-12T10:01:00.000Z",
        durationSeconds: 5,
        exists: true,
        id: "b",
        kind: "clip",
        mediaUrl: null,
        name: "a.mp4",
        sizeBytes: 1,
        sourceGame: "poe1",
        sourceLeague: "Standard",
        status: "ready",
        subtitle: "Death clip - Standard",
      },
      {
        assetKey: "clip:c",
        category: "death-clip",
        createdAt: "2026-06-12T10:01:00.000Z",
        durationSeconds: 5,
        exists: true,
        id: "c",
        kind: "clip",
        mediaUrl: null,
        name: "b.mp4",
        sizeBytes: 1,
        sourceGame: "poe1",
        sourceLeague: "Standard",
        status: "ready",
        subtitle: "Death clip - Standard",
      },
    ]);

    expect(sorted.map((asset) => asset.assetKey)).toEqual([
      "clip:b",
      "clip:c",
      "clip:a",
    ]);
  });

  it("creates single-asset and empty project titles", () => {
    expect(
      createEditorProjectFromAssets({
        assets: [
          {
            assetKey: "clip:single",
            category: "death-clip",
            createdAt: "2026-06-12T10:00:00.000Z",
            durationSeconds: 1,
            exists: true,
            id: "single",
            kind: "clip",
            mediaUrl: null,
            name: "single.mp4",
            sizeBytes: 1,
            sourceGame: "poe1",
            sourceLeague: "Standard",
            status: "ready",
            subtitle: "Death clip - Standard",
          },
        ],
        id: "project-single",
        now: "2026-06-12T10:02:00.000Z",
      }).title,
    ).toBe("single.mp4 edit");
    expect(
      createEditorProjectFromAssets({
        assets: [],
        id: "project-empty",
        now: "2026-06-12T10:02:00.000Z",
      }).title,
    ).toBe("Untitled edit");
  });
});
