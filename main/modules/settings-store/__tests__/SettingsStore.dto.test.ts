import { describe, expect, it } from "vitest";

import { createDefaultSettings } from "~/types";
import { createSettingsStoreClipPreviewOverlaySnapshot } from "../SettingsStore.dto";

describe("clip preview settings snapshot", () => {
  it.each([null, "default", "selected-output-device"])(
    "includes the audio output selection (%s) without unrelated settings",
    (recordingAudioOutputDeviceId) => {
      const settings = {
        ...createDefaultSettings(),
        recordingAudioOutputDeviceId,
      };
      expect(createSettingsStoreClipPreviewOverlaySnapshot(settings)).toEqual({
        clipPreviewInfoAlertDismissed: settings.clipPreviewInfoAlertDismissed,
        recordingAudioOutputDeviceId,
        telemetryCrashReporting: settings.telemetryCrashReporting,
      });
    },
  );
});
