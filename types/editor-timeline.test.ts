import { describe, expect, it } from "vitest";

import {
  calculateTimelineProjectDuration,
  defaultEditorTimelinePlaybackRate,
  editorTimelinePlaybackRates,
  isEditorTimelinePlaybackRate,
  maxEditorExportDurationSeconds,
  normalizeTimelineProject,
} from "./editor-timeline";

describe("editor timeline helpers", () => {
  it("calculates durations and preserves existing duration when requested", () => {
    const project = {
      durationSeconds: 10,
      tracks: [
        {
          clips: [{ durationSeconds: 2, id: "timeline-a", startSeconds: 1 }],
        },
      ],
    };

    expect(calculateTimelineProjectDuration(project.tracks)).toBe(3);
    expect(normalizeTimelineProject(project, { preserveDuration: true })).toBe(
      project,
    );
  });

  it("uses clip ids as deterministic tie breakers for equal starts", () => {
    const project = {
      durationSeconds: 2,
      tracks: [
        {
          clips: [
            { durationSeconds: 1, id: "timeline-b", startSeconds: 0 },
            { durationSeconds: 1, id: "timeline-a", startSeconds: 0 },
          ],
        },
      ],
    };

    expect(
      normalizeTimelineProject(project).tracks[0]?.clips.map((clip) => ({
        id: clip.id,
        startSeconds: clip.startSeconds,
      })),
    ).toEqual([
      { id: "timeline-a", startSeconds: 0 },
      { id: "timeline-b", startSeconds: 1 },
    ]);
  });

  it("recognizes supported playback rates", () => {
    expect(editorTimelinePlaybackRates).toEqual([
      0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 8, 16,
    ]);
    expect(defaultEditorTimelinePlaybackRate).toBe(1);
    expect(maxEditorExportDurationSeconds).toBe(86_400);
    expect(isEditorTimelinePlaybackRate(16)).toBe(true);
    expect(isEditorTimelinePlaybackRate(1.1)).toBe(false);
  });
});
