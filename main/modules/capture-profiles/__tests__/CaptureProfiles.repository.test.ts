import { describe, expect, it } from "vitest";

import { createDefaultCaptureProfile } from "~/types";
import { DatabaseService } from "../../database";
import { mapCaptureProfileRow } from "../CaptureProfiles.mapper";
import { CaptureProfilesRepository } from "../CaptureProfiles.repository";

describe("CaptureProfilesRepository", () => {
  it("uses default capture profile values for malformed JSON payloads", () => {
    expect(
      mapCaptureProfileRow({
        id: "capture-profile-1",
        name: "Imported",
        game: "poe1",
        data_json: "null",
        created_at: "2026-07-01T10:00:00.000Z",
        updated_at: "2026-07-01T10:00:00.000Z",
      }),
    ).toMatchObject({
      id: "capture-profile-1",
      name: "Imported",
      game: "poe1",
      deathClipSeconds: 10,
      recordingOutputResolution: "native",
      recordingAutoStartMode: "off",
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z",
      isDefault: false,
    });

    expect(
      mapCaptureProfileRow({
        id: "capture-profile-invalid-json",
        name: "Invalid imported",
        game: "poe2",
        data_json: "{bad",
        created_at: "2026-07-01T11:00:00.000Z",
        updated_at: "2026-07-01T11:00:00.000Z",
      }),
    ).toMatchObject({
      id: "capture-profile-invalid-json",
      name: "Invalid imported",
      game: "poe2",
      recordingOutputResolution: "native",
      recordingAutoStartMode: "off",
      isDefault: false,
    });

    expect(
      mapCaptureProfileRow({
        id: "capture-profile-unsupported-resolution",
        name: "Older imported profile",
        game: "poe1",
        data_json: JSON.stringify({
          recordingOutputResolution: "854x480",
        }),
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      }).recordingOutputResolution,
    ).toBe("native");
  });

  it("migrates a missing manual replay timer from a profile's death timer", () => {
    expect(
      mapCaptureProfileRow({
        id: "legacy-profile",
        name: "Legacy profile",
        game: "poe1",
        data_json: JSON.stringify({ deathClipSeconds: 43 }),
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
      }),
    ).toMatchObject({
      deathClipsEnabled: true,
      deathClipSeconds: 43,
      manualReplaySeconds: 43,
    });
  });

  it("creates, updates, lists, upserts, and deletes capture profiles", () => {
    const database = new DatabaseService(":memory:");
    const repository = new CaptureProfilesRepository(database);

    const created = repository.create({
      captureTarget: {
        id: "display-2",
        kind: "display",
        label: "Display 2",
      },
      name: "Recording setup",
      game: "poe2",
      recordingEncoder: "hardware_h265",
      recordingFps: 60,
      recordingOutputResolution: "1280x720",
      recordingRunQuality: "low",
    });

    expect(repository.list()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    );
    expect(created).toMatchObject({
      captureTarget: {
        id: "display-2",
        kind: "display",
        label: "Display 2",
      },
      deathClipSeconds: 10,
      game: "poe2",
      isDefault: false,
      recordingAutoStartMode: "off",
      recordingHideOverlaysFromRecording: true,
      recordingHideOverlaysFromRewind: true,
      recordingEncoder: "hardware_h265",
      recordingFps: 60,
      recordingOutputResolution: "1280x720",
      recordingRunQuality: "low",
    });

    const updated = repository.update({
      id: created.id,
      captureTarget: {
        kind: "window",
        id: "window:poe2:1",
        label: "Path of Exile 2",
        game: "poe2",
      },
      deathClipSeconds: 45,
      name: "Bossing capture",
      recordingAudioInputDeviceId: "mic-1",
      recordingAutoStartMode: "rewind",
    });

    expect(updated).toMatchObject({
      id: created.id,
      captureTarget: {
        id: "window:poe2:1",
        kind: "window",
      },
      deathClipSeconds: 45,
      name: "Bossing capture",
      recordingAudioInputDeviceId: "mic-1",
      recordingAutoStartMode: "rewind",
    });

    expect(
      repository.update({
        id: created.id,
        deathClipSeconds: 60,
        recordingAudioInputDeviceId: "mic-2",
        recordingAudioOutputDeviceId: "speaker-1",
        recordingAutoStartMode: "recording",
        recordingClipQuality: "ultra",
        recordingEncoder: "hardware_h265",
        recordingFps: 120,
        recordingHideOverlaysFromRecording: false,
        recordingHideOverlaysFromRewind: false,
        recordingOutputResolution: "1920x1080",
        recordingRunQuality: "high",
      }),
    ).toMatchObject({
      deathClipSeconds: 60,
      recordingAudioInputDeviceId: "mic-2",
      recordingAudioOutputDeviceId: "speaker-1",
      recordingAutoStartMode: "recording",
      recordingClipQuality: "ultra",
      recordingEncoder: "hardware_h265",
      recordingFps: 120,
      recordingHideOverlaysFromRecording: false,
      recordingHideOverlaysFromRewind: false,
      recordingOutputResolution: "1920x1080",
      recordingRunQuality: "high",
    });

    expect(
      repository.update({
        id: created.id,
        captureTarget: null,
        recordingAudioInputDeviceId: null,
        recordingAudioOutputDeviceId: null,
      }),
    ).toMatchObject({
      captureTarget: null,
      recordingAudioInputDeviceId: null,
      recordingAudioOutputDeviceId: null,
    });
    expect(() =>
      repository.update({
        id: "missing-profile",
        name: "Missing",
      }),
    ).toThrow("Capture profile not found");

    const replacement = {
      ...createDefaultCaptureProfile({
        name: "Replacement",
        game: "poe1",
      }),
      id: "replacement",
    };
    repository.upsert(replacement);
    expect(repository.list()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "replacement" })]),
    );

    repository.delete(created.id);
    expect(repository.list()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: replacement.id })]),
    );

    const finalReplacement = {
      ...createDefaultCaptureProfile({
        name: "Final replacement",
        game: "poe2",
      }),
      id: "final-replacement",
    };
    repository.replaceAll([finalReplacement]);
    expect(repository.list()).toEqual([finalReplacement]);

    database.close();
  });
});
