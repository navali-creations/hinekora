import { describe, expect, it } from "vitest";

import {
  createManagedRecorderStatusTestFixture,
  createManagedRunRecordingSessionTestFixture,
} from "~/renderer/modules/managed-recorder/ManagedRecorder.test-utils";
import { ALL_LEAGUES_VALUE } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import {
  createTransientRunRecordingRow,
  formatRecordingTableStatus,
  getRecordingTableStatusBadgeClassName,
} from "./RecordingsPanel.utils";

describe("RecordingsPanel utilities", () => {
  it("labels each recording lifecycle state", () => {
    expect(formatRecordingTableStatus("recording")).toBe("Recording");
    expect(formatRecordingTableStatus("processing")).toBe("Processing");
    expect(formatRecordingTableStatus("saved")).toBe("Saved");
    expect(getRecordingTableStatusBadgeClassName("recording")).toContain(
      "badge-warning",
    );
    expect(getRecordingTableStatusBadgeClassName("saved")).toContain(
      "badge-success",
    );
  });

  it("does not present a stopping rewind buffer as a processing recording", () => {
    const status = createManagedRecorderStatusTestFixture({
      activeGame: "poe2",
      bufferActive: true,
      isStoppingRecording: true,
      recording: true,
      recordingStartedAt: "2026-09-04T03:38:00.000Z",
    });

    expect(
      createTransientRunRecordingRow({
        now: new Date("2026-09-05T03:28:00.000Z"),
        scope: { game: "poe2", league: ALL_LEAGUES_VALUE },
        status,
      }),
    ).toBeNull();
  });

  it("creates an active row from the run recording timestamp", () => {
    const startedAt = "2026-09-05T03:27:50.000Z";
    const status = createManagedRecorderStatusTestFixture({
      activeGame: "poe2",
      recording: true,
      recordingStartedAt: "2026-09-04T03:38:00.000Z",
      runRecordingActive: true,
      runRecordingSession: createManagedRunRecordingSessionTestFixture({
        path: "C:\\recordings\\run.mp4",
        startedAt,
      }),
    });

    expect(
      createTransientRunRecordingRow({
        now: new Date("2026-09-05T03:28:00.000Z"),
        scope: { game: "poe2", league: ALL_LEAGUES_VALUE },
        status,
      }),
    ).toMatchObject({
      createdAt: startedAt,
      durationSeconds: 10,
      fileName: "Active recording",
      path: "C:\\recordings\\run.mp4",
      sourceLeague: "Runes of Aldur",
      tableStatus: "recording",
    });
  });

  it("keeps a stopped run visible while its file is being finalized", () => {
    const startedAt = "2026-09-05T03:27:50.000Z";
    const status = createManagedRecorderStatusTestFixture({
      activeGame: "poe2",
      isStoppingRecording: true,
      recordingStartedAt: "2026-09-04T03:38:00.000Z",
      runRecordingSession: createManagedRunRecordingSessionTestFixture({
        sourceLeague: "Runes of Aldur",
        startedAt,
        state: "processing",
        stoppedAt: "2026-09-05T03:27:57.500Z",
      }),
    });

    expect(
      createTransientRunRecordingRow({
        now: new Date("2026-09-05T03:28:00.000Z"),
        scope: { game: "poe2", league: "Runes of Aldur" },
        status,
      }),
    ).toMatchObject({
      createdAt: startedAt,
      durationSeconds: 7.5,
      fileName: "Processing recording",
      sourceLeague: "Runes of Aldur",
      tableStatus: "processing",
    });
  });

  it("filters by the league captured when recording started", () => {
    const status = createManagedRecorderStatusTestFixture({
      runRecordingSession: createManagedRunRecordingSessionTestFixture({
        sourceLeague: "Hardcore",
      }),
    });

    expect(
      createTransientRunRecordingRow({
        now: new Date("2026-09-05T03:28:00.000Z"),
        scope: { game: "poe2", league: "Runes of Aldur" },
        status,
      }),
    ).toBeNull();
    expect(
      createTransientRunRecordingRow({
        now: new Date("2026-09-05T03:28:00.000Z"),
        scope: { game: "poe2", league: "Hardcore" },
        status,
      }),
    ).toMatchObject({ sourceLeague: "Hardcore" });
  });
});
