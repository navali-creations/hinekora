import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  collectRecordingFilePaths,
  createFittedSceneItemPosition,
  findNewestRecordingFile,
  formatRecordingResolution,
  formatRecordingTimestamp,
  parseRecordingResolution,
  parseScreenCaptureSourceIndex,
  resolveManagedCaptureSourceType,
  resolveManagedRecordingResolution,
  resolveManagedVideoEncoder,
  resolveManagedVideoEncoderSettings,
  resolveReplaySaveWaitMs,
  selectDisplayMonitor,
  selectWgcCaptureMethod,
  selectWindow,
} from "../ManagedRecorder.utils";

describe("ManagedRecorder utils", () => {
  it("formats a local filesystem-safe recording timestamp", () => {
    const date = new Date(2026, 5, 8, 9, 4, 7);

    expect(formatRecordingTimestamp(date)).toBe("2026-06-08_09-04-07");
  });

  it("finds the newest non-empty recording file under a session directory", () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-recording-"));

    try {
      writeFileSync(join(directory, "empty.mkv"), "");
      writeFileSync(join(directory, "clip-a.mkv"), "a");
      writeFileSync(join(directory, "clip-b.mp4"), "bb");
      utimesSync(join(directory, "clip-a.mkv"), new Date(1000), new Date(1000));
      utimesSync(join(directory, "clip-b.mp4"), new Date(2000), new Date(2000));

      expect(findNewestRecordingFile(directory)).toMatch(/clip-b\.mp4$/);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("handles recursive recording discovery filters", () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-recording-"));

    try {
      const nested = join(directory, "nested");
      mkdirSync(nested);
      const ignoredPath = join(directory, "ignored.mp4");
      const oldPath = join(nested, "old.mkv");
      const newestPath = join(nested, "newest.mov");
      writeFileSync(ignoredPath, "ignored");
      writeFileSync(oldPath, "old");
      writeFileSync(newestPath, "newest");
      writeFileSync(join(nested, "notes.txt"), "not a recording");
      utimesSync(ignoredPath, new Date("2026-03-01"), new Date("2026-03-01"));
      utimesSync(oldPath, new Date("2026-01-01"), new Date("2026-01-01"));
      utimesSync(newestPath, new Date("2026-02-01"), new Date("2026-02-01"));

      expect([oldPath, newestPath]).toContain(
        findNewestRecordingFile(directory, 0, new Set([ignoredPath])),
      );
      expect(
        findNewestRecordingFile(directory, Date.now() + 10_000),
      ).toBeNull();
      expect(collectRecordingFilePaths(directory)).toEqual(
        new Set([ignoredPath, oldPath, newestPath]),
      );
      expect(collectRecordingFilePaths(join(directory, "missing"))).toEqual(
        new Set(),
      );
      expect(findNewestRecordingFile(ignoredPath)).toBeNull();
      expect(collectRecordingFilePaths(ignoredPath)).toEqual(new Set());
      expect(findNewestRecordingFile("")).toBeNull();
      expect(collectRecordingFilePaths("")).toEqual(new Set());
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("ignores recording candidates whose file metadata cannot be read", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        readdirSync: () => [
          {
            isDirectory: () => false,
            name: "2026-06-12_10-30-00.mp4",
          },
        ],
        statSync: () => {
          throw new Error("stat failed");
        },
      };
    });

    try {
      const { findNewestRecordingFile: findWithFailingStat } = await import(
        "../ManagedRecorder.utils"
      );

      expect(findWithFailingStat("recordings")).toBeNull();
    } finally {
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });

  it("uses OBS window capture for Path of Exile windows", () => {
    expect(
      resolveManagedCaptureSourceType({
        kind: "window",
        id: "window:1234:0",
        label: "Path of Exile 2",
      }),
    ).toBe("window_capture");
  });

  it("parses Electron screen capture source indexes", () => {
    expect(parseScreenCaptureSourceIndex("screen:0:0")).toBe(0);
    expect(parseScreenCaptureSourceIndex("screen:2:1")).toBe(2);
    expect(parseScreenCaptureSourceIndex("window:123:0")).toBeNull();
  });

  it("parses and formats explicit recording resolutions", () => {
    expect(parseRecordingResolution("2560x1440")).toEqual({
      width: 2560,
      height: 1440,
    });
    expect(parseRecordingResolution("native")).toBeNull();
    expect(formatRecordingResolution({ width: 3440, height: 1440 })).toBe(
      "3440x1440",
    );
    expect(parseRecordingResolution("1920")).toBeNull();
    expect(parseRecordingResolution("0x1080")).toBeNull();
  });

  it("prefers the native display resolution over the cached source size", () => {
    expect(
      resolveManagedRecordingResolution(
        "native",
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ width: 1920, height: 1080 });
  });

  it("uses the cached source size only when native display size is unavailable", () => {
    expect(
      resolveManagedRecordingResolution(
        "native",
        null,
        { width: 2560, height: 1440 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ width: 2560, height: 1440 });
  });

  it("falls back to the default resolution when no requested size can be resolved", () => {
    expect(
      resolveManagedRecordingResolution("native", null, null, {
        width: 800,
        height: 600,
      }),
    ).toEqual({ width: 800, height: 600 });
  });

  it("keeps explicit recording resolution above native display size", () => {
    expect(
      resolveManagedRecordingResolution(
        "1280x720",
        { width: 1920, height: 1080 },
        { width: 2560, height: 1440 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ width: 1280, height: 720 });
  });

  it("uses a bounded wait for replay conversion finalization", () => {
    expect(
      resolveReplaySaveWaitMs({
        requestedSeconds: 10,
        outputResolution: { width: 1920, height: 1080 },
        fps: 30,
      }),
    ).toBe(30_000);
    expect(
      resolveReplaySaveWaitMs({
        requestedSeconds: 10,
        outputResolution: null,
        fps: 30,
      }),
    ).toBe(30_000);
  });

  it("scales replay conversion wait for large high-fps captures", () => {
    expect(
      resolveReplaySaveWaitMs({
        requestedSeconds: 60,
        outputResolution: { width: 3840, height: 2160 },
        fps: 60,
      }),
    ).toBe(90_000);
  });

  it("uses CRF quality control for the software x264 encoder", () => {
    expect(resolveManagedVideoEncoder("obs_x264", [])).toBe("obs_x264");
    expect(resolveManagedVideoEncoderSettings("obs_x264", "high")).toEqual({
      keyint_sec: 1,
      rate_control: "CRF",
      crf: 26,
    });
  });

  it("prefers texture-based NVIDIA H.264 for hardware H.264 recording", () => {
    expect(
      resolveManagedVideoEncoder("hardware_h264", [
        "obs_x264",
        "obs_nvenc_h264_soft",
        "obs_nvenc_h264_tex",
      ]),
    ).toBe("obs_nvenc_h264_tex");
  });

  it("resolves hardware codec choices to AMD AMF encoders", () => {
    expect(
      resolveManagedVideoEncoder("hardware_h265", [
        "obs_x264",
        "h265_texture_amf",
      ]),
    ).toBe("h265_texture_amf");
    expect(
      resolveManagedVideoEncoder("hardware_av1", [
        "obs_x264",
        "av1_texture_amf",
      ]),
    ).toBe("av1_texture_amf");
  });

  it("falls back to hardware H.264 then software x264", () => {
    expect(
      resolveManagedVideoEncoder("hardware_av1", ["obs_x264", "obs_qsv11_v2"]),
    ).toBe("obs_qsv11_v2");
    expect(resolveManagedVideoEncoder("hardware_h264", ["obs_x264"])).toBe(
      "obs_x264",
    );
  });

  it("keeps legacy auto on the hardware H.264 path", () => {
    expect(
      resolveManagedVideoEncoder("auto", ["obs_x264", "h264_texture_amf"]),
    ).toBe("h264_texture_amf");
  });

  it("uses CQP quality control for hardware encoders", () => {
    expect(
      resolveManagedVideoEncoderSettings("obs_nvenc_h264_tex", "moderate"),
    ).toEqual({
      keyint_sec: 1,
      rate_control: "CQP",
      cqp: 30,
    });
  });

  it("uses lower CQP values for AV1 encoders", () => {
    expect(
      resolveManagedVideoEncoderSettings("obs_nvenc_av1_tex", "high"),
    ).toEqual({
      keyint_sec: 1,
      rate_control: "CQP",
      cqp: 24,
    });
    expect(
      resolveManagedVideoEncoderSettings("obs_nvenc_av1_tex", "ultra"),
    ).toEqual({
      keyint_sec: 1,
      rate_control: "CQP",
      cqp: 20,
    });
    expect(
      resolveManagedVideoEncoderSettings("obs_nvenc_av1_tex", "moderate"),
    ).toEqual({
      keyint_sec: 1,
      rate_control: "CQP",
      cqp: 28,
    });
    expect(
      resolveManagedVideoEncoderSettings("obs_nvenc_av1_tex", "low"),
    ).toEqual({
      keyint_sec: 1,
      rate_control: "CQP",
      cqp: 32,
    });
    expect(
      resolveManagedVideoEncoderSettings("obs_nvenc_h264_tex", "ultra"),
    ).toEqual({
      keyint_sec: 1,
      rate_control: "CQP",
      cqp: 22,
    });
    expect(
      resolveManagedVideoEncoderSettings("obs_nvenc_h264_tex", "low"),
    ).toEqual({
      keyint_sec: 1,
      rate_control: "CQP",
      cqp: 34,
    });
  });

  it("fits a 2K source into a 1080p canvas without cropping", () => {
    expect(
      createFittedSceneItemPosition(
        { width: 2560, height: 1440 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({
      x: 0,
      y: 0,
      scaleX: 0.75,
      scaleY: 0.75,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
    });
  });

  it("selects WGC when OBS exposes a Windows 10 capture method", () => {
    expect(
      selectWgcCaptureMethod([
        {
          name: "method",
          items: [
            { name: "Automatic", value: 0 },
            { name: "DXGI Desktop Duplication", value: 1 },
            { name: "Windows 10 (1903 and up)", value: 2 },
          ],
        },
      ]),
    ).toBe(2);
  });

  it("matches OBS window items by the preview source label", () => {
    expect(
      selectWindow(
        [
          {
            name: "window",
            items: [
              {
                name: "[PathOfExileSteam.exe]: Path of Exile 2",
                value: "Path of Exile 2:POEWindowClass:PathOfExileSteam.exe",
              },
            ],
          },
        ],
        {
          kind: "window",
          id: "window:1234:0",
          label: "Path of Exile 2",
        },
      )?.value,
    ).toBe("Path of Exile 2:POEWindowClass:PathOfExileSteam.exe");
    expect(
      selectWindow([], {
        kind: "window",
        id: "window:missing:0",
        label: "Missing",
      }),
    ).toBeNull();
  });

  it("selects the primary display when a screen target cannot be matched", () => {
    expect(
      selectDisplayMonitor(
        [
          {
            name: "monitor_id",
            items: [
              {
                name: "[Select a display to capture]",
                value: "DUMMY",
                disabled: true,
              },
              { name: "Side Monitor", value: "side-display" },
              {
                name: "Main Display (Primary Monitor)",
                value: "primary-display",
              },
            ],
          },
        ],
        {
          kind: "display",
          id: "screen:unknown:0",
          label: "Entire Screen",
        },
      )?.value,
    ).toBe("primary-display");
  });
});
