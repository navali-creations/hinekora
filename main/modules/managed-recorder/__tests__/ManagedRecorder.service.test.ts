import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { BookmarksService } from "~/main/modules/bookmarks";
import { CaptureProfilesService } from "~/main/modules/capture-profiles";
import { DatabaseService } from "~/main/modules/database";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";
import * as AppLog from "~/main/utils/app-log";
import { isAsarVirtualPath } from "~/main/utils/asar-path";

import {
  type AppSettings,
  type CaptureProfile,
  createDefaultCaptureProfile,
  createDefaultSettings,
  type GameId,
  type ManagedRecorderStatus,
} from "~/types";
import { ManagedRecorderChannel } from "../ManagedRecorder.channels";
import {
  describeNoobsRuntimeLocation,
  ManagedRecorderService,
} from "../ManagedRecorder.service";

const electronMocks = vi.hoisted(() => ({
  getAllDisplays: vi.fn(),
  getAllWindows: vi.fn(),
  getPath: vi.fn(),
  getPrimaryDisplay: vi.fn(),
  ipcMainHandle: vi.fn(),
  isPackaged: false,
}));

const noobsMocks = vi.hoisted(() => ({
  importNoobsModule: vi.fn(),
  loadNoobsApi: vi.fn(),
}));

const pollerMocks = vi.hoisted(() => ({
  refreshPoeProcessState: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronMocks.isPackaged;
    },
    getPath: electronMocks.getPath,
  },
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
  ipcMain: {
    handle: electronMocks.ipcMainHandle,
  },
  screen: {
    getAllDisplays: electronMocks.getAllDisplays,
    getPrimaryDisplay: electronMocks.getPrimaryDisplay,
  },
}));

vi.mock("../ManagedRecorder.noobs", () => ({
  importNoobsModule: noobsMocks.importNoobsModule,
  loadNoobsApi: noobsMocks.loadNoobsApi,
}));

vi.mock("~/main/pollers", () => ({
  refreshPoeProcessState: pollerMocks.refreshPoeProcessState,
  isProcessStateForGame: (
    state: {
      game?: GameId | null;
      isRunning: boolean;
      processName: string;
    },
    game: GameId,
  ) => {
    if (!state.isRunning) {
      return false;
    }

    return state.game === game;
  },
}));

let directory: string;
let send: Mock<(channel: string, payload: unknown) => void>;

beforeEach(() => {
  DatabaseService.resetForTests();
  RecordingStorageService.resetForTests();
  directory = mkdtempSync(join(tmpdir(), "hinekora-managed-recorder-"));
  send = vi.fn<(channel: string, payload: unknown) => void>();
  electronMocks.getAllDisplays.mockReturnValue([]);
  electronMocks.getAllWindows.mockReturnValue([
    { isDestroyed: () => false, webContents: { send } },
  ]);
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.getPath.mockImplementation((name: string) =>
    name === "videos" ? join(directory, "videos") : directory,
  );
  electronMocks.getPrimaryDisplay.mockReturnValue({
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    id: 1,
    scaleFactor: 1,
    size: { width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  });
  electronMocks.isPackaged = false;
  noobsMocks.loadNoobsApi.mockReset();
  noobsMocks.importNoobsModule.mockReset();
  pollerMocks.refreshPoeProcessState.mockResolvedValue({
    game: "poe1",
    isRunning: true,
    processName: "PathOfExileSteam.exe",
  });
  vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
    get: () => ({
      ...createDefaultSettings(),
      recordingStoragePath: directory,
      recordingFps: 60,
      recordingOutputResolution: "1920x1080",
      recordingEncoder: "hardware_h264",
    }),
  } as unknown as SettingsStoreService);
  vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
    list: () => [
      {
        ...createDefaultCaptureProfile({ name: "Default", game: "poe1" }),
        captureTarget: {
          kind: "display",
          id: "primary",
          label: "Primary display",
          width: 1920,
          height: 1080,
        },
      },
    ],
  } as unknown as CaptureProfilesService);
});

afterEach(() => {
  vi.useRealTimers();
  electronMocks.getAllDisplays.mockReset();
  electronMocks.getAllWindows.mockReset();
  electronMocks.getPath.mockReset();
  electronMocks.getPrimaryDisplay.mockReset();
  noobsMocks.loadNoobsApi.mockReset();
  noobsMocks.importNoobsModule.mockReset();
  pollerMocks.refreshPoeProcessState.mockReset();
  vi.restoreAllMocks();
  RecordingStorageService.resetForTests();
  DatabaseService.resetForTests();
  delete process.env.HINEKORA_NOOBS_PATH;
  rmSync(directory, { force: true, recursive: true });
});

function createService(): ManagedRecorderService {
  return new ManagedRecorderService();
}

function createNoobsApi() {
  return {
    AddSourceToScene: vi.fn<(sourceName: string) => void>(),
    CreateSource: vi.fn<(name: string, type: string) => string>(
      () => "source-1",
    ),
    DeleteSource: vi.fn<(sourceName: string) => void>(),
    ForceStopRecording: vi.fn(),
    GetLastRecording: vi.fn<() => string | null>(() => null),
    GetSourcePos: vi.fn(() => ({ x: 0, y: 0, width: 1280, height: 720 })),
    GetSourceProperties: vi.fn<(sourceName: string) => unknown[]>(() => []),
    GetSourceSettings: vi.fn<(sourceName: string) => Record<string, unknown>>(
      () => ({}),
    ),
    Init: vi.fn(),
    ListVideoEncoders: vi.fn(() => ["h264_texture_amf", "obs_x264"]),
    RemoveSourceFromScene: vi.fn<(sourceName: string) => void>(),
    ResetVideoContext: vi.fn(),
    SetBuffering: vi.fn(),
    SetRecordingCfg: vi.fn(),
    SetSourcePos: vi.fn(),
    SetSourceSettings:
      vi.fn<(sourceName: string, settings: Record<string, unknown>) => void>(),
    SetSourceVolume: vi.fn<(sourceName: string, volume: number) => void>(),
    SetVideoEncoder: vi.fn(),
    StartBuffer: vi.fn(),
    StartRecording: vi.fn(),
    StopRecording: vi.fn(),
  };
}

describe("ManagedRecorderService", () => {
  it("creates and reuses the singleton instance", () => {
    const singletonAccess = ManagedRecorderService as unknown as {
      instance: ManagedRecorderService | null;
    };
    singletonAccess.instance = null;

    const first = ManagedRecorderService.getInstance();
    const second = ManagedRecorderService.getInstance();

    expect(first).toBe(second);
    singletonAccess.instance = null;
  });

  it("refreshes status from settings without touching noobs", () => {
    const service = createService();

    expect(service.getStatus()).toMatchObject({
      initialized: false,
      outputDirectory: directory,
      fps: 60,
    });
  });

  it("notifies main-process observers when recorder state changes", () => {
    const service = createService();
    const listener = vi.fn();

    const unsubscribe = service.onDidChange(listener);
    service.setCaptureMode("session");

    expect(listener).toHaveBeenCalledWith({
      captureMode: "session",
      status: expect.objectContaining({
        bufferActive: false,
        runRecordingActive: false,
      }),
    });

    unsubscribe();
    service.setCaptureMode("rewind");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("logs recorder observer failures without interrupting publication", () => {
    const service = createService();
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    const failingListener = vi.fn(() => {
      throw new Error("observer failed");
    });
    const succeedingListener = vi.fn();

    service.onDidChange(failingListener);
    service.onDidChange(succeedingListener);
    service.setCaptureMode("session");

    expect(succeedingListener).toHaveBeenCalledWith({
      captureMode: "session",
      status: expect.objectContaining({
        bufferActive: false,
        runRecordingActive: false,
      }),
    });
    expect(logWarn).toHaveBeenCalledWith(
      "managed-recorder",
      "Recorder change listener failed",
      {
        error: "observer failed",
      },
    );
  });

  it("refreshes status with native output labels and default storage paths", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: null,
        recordingOutputResolution: "native",
        recordingFps: 30,
      }),
    } as unknown as SettingsStoreService);
    const service = createService();

    expect(service.getStatus()).toMatchObject({
      outputDirectory: expect.stringContaining("Hinekora"),
      outputResolution: "Native source",
      fps: 30,
    });
  });

  it("guards mutually exclusive buffer and run recording modes", async () => {
    const service = createService();
    const internals = service as unknown as {
      status: ReturnType<ManagedRecorderService["getStatus"]>;
    };
    internals.status = {
      ...service.getStatus(),
      runRecordingActive: true,
    };

    await expect(service.startBuffer()).resolves.toMatchObject({
      error: "Stop full run recording before starting the replay buffer",
    });

    internals.status = {
      ...service.getStatus(),
      runRecordingActive: false,
      bufferActive: true,
    };
    await expect(service.startRunRecording()).resolves.toMatchObject({
      error: "Stop the replay buffer before starting full run recording",
    });
  });

  it("serializes concurrent buffer and run recording start requests", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.initialize = vi.fn().mockResolvedValue(undefined);

    await Promise.all([service.startBuffer(), service.startRunRecording()]);

    expect(noobs.StartBuffer).toHaveBeenCalledTimes(1);
    expect(noobs.StartRecording).not.toHaveBeenCalled();
    expect(service.getStatus()).toMatchObject({
      bufferActive: true,
      recording: true,
      runRecordingActive: false,
    });
  });

  it("reports a blocked start while another recording mode is starting", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.initialize = vi.fn().mockResolvedValue(undefined);

    const [, runStatus] = await Promise.all([
      service.startBuffer(),
      service.startRunRecording(),
    ]);

    expect(runStatus.error).toBe("Replay buffer is already starting");
  });

  it("resolves recording start block messages for stopping and stale starting states", () => {
    const service = createService();
    const internals = service as unknown as {
      finishRecordingStart(mode: "buffer" | "run"): void;
      resolveRecordingStartBlockedMessage(mode: "buffer" | "run"): string;
      startingRecordingMode: "buffer" | "run" | null;
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      isStoppingRecording: true,
    };

    expect(internals.resolveRecordingStartBlockedMessage("buffer")).toBe(
      "Wait for the current recording to stop before starting another recording",
    );

    internals.status = {
      ...service.getStatus(),
      isStoppingRecording: false,
    };
    internals.startingRecordingMode = "run";
    expect(internals.resolveRecordingStartBlockedMessage("buffer")).toBe(
      "Full run recording is already starting",
    );

    internals.startingRecordingMode = "buffer";
    expect(internals.resolveRecordingStartBlockedMessage("buffer")).toBe(
      "Recording is already starting",
    );

    internals.startingRecordingMode = "run";
    internals.finishRecordingStart("buffer");
    expect(internals.startingRecordingMode).toBe("run");
  });

  it("serializes concurrent run recording and buffer start requests", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.initialize = vi.fn().mockResolvedValue(undefined);

    await Promise.all([service.startRunRecording(), service.startBuffer()]);

    expect(noobs.StartRecording).toHaveBeenCalledTimes(1);
    expect(noobs.StartBuffer).not.toHaveBeenCalled();
    expect(service.getStatus()).toMatchObject({
      bufferActive: false,
      recording: true,
      runRecordingActive: true,
    });
  });

  it("blocks recording starts when the active game is not running", async () => {
    pollerMocks.refreshPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    const service = createService();
    const internals = service as unknown as {
      initialize(): Promise<void>;
    };
    internals.initialize = vi.fn().mockResolvedValue(undefined);

    await expect(service.startBuffer()).resolves.toMatchObject({
      bufferActive: false,
      error: "Path of Exile 1 is not running",
      gameRunning: false,
    });
    await expect(service.startRunRecording()).resolves.toMatchObject({
      error: "Path of Exile 1 is not running",
      runRecordingActive: false,
    });
    expect(pollerMocks.refreshPoeProcessState).toHaveBeenCalledWith("poe1");
    expect(internals.initialize).not.toHaveBeenCalled();
  });

  it("returns current status for already-active recorder modes", async () => {
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      activeGame: "poe2",
      bufferActive: true,
      recording: true,
    };

    await expect(service.startBuffer()).resolves.toMatchObject({
      bufferActive: true,
      recording: true,
    });
    await expect(service.stopRunRecording()).resolves.toMatchObject({
      runRecordingActive: false,
    });

    internals.status = {
      ...service.getStatus(),
      runRecordingActive: true,
      recording: true,
    };
    await expect(service.startRunRecording()).resolves.toMatchObject({
      runRecordingActive: true,
      recording: true,
    });
  });

  it("starts replay buffers at 1080p H.264 instead of the run recording format", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: directory,
        recordingFps: 60,
        recordingOutputResolution: "2560x1440",
        recordingEncoder: "hardware_av1",
      }),
    } as unknown as SettingsStoreService);
    const service = createService();
    const noobs = createNoobsApi();
    noobs.ListVideoEncoders.mockReturnValue([
      "obs_nvenc_av1_tex",
      "h264_texture_amf",
      "obs_x264",
    ]);
    const internals = service as unknown as {
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.initialize = vi.fn().mockResolvedValue(undefined);

    await expect(service.startBuffer()).resolves.toMatchObject({
      bufferActive: true,
      recording: true,
      isStartingRecording: false,
      activeGame: "poe1",
      activeSessionDirectory: join(directory, "Death Clips"),
      outputResolution: "1920x1080",
      encoder: "h264_texture_amf",
      error: null,
    });

    expect(noobs.SetBuffering).toHaveBeenCalledWith(true);
    expect(noobs.StartBuffer).toHaveBeenCalled();
    expect(noobs.ResetVideoContext).toHaveBeenCalledWith(60, 1920, 1080);
    expect(noobs.SetRecordingCfg).toHaveBeenCalledWith(
      join(directory, "Death Clips"),
      "mp4",
    );
    expect(noobs.SetVideoEncoder).toHaveBeenCalledWith(
      "h264_texture_amf",
      expect.objectContaining({ rate_control: "CQP" }),
    );
  });

  it("falls back to software x264 when hardware H.264 is unavailable", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: directory,
        recordingFps: 30,
        recordingOutputResolution: "1280x720",
        recordingEncoder: "hardware_av1",
        recordingClipQuality: "high",
      }),
    } as unknown as SettingsStoreService);
    const beginRewindSession = vi.fn();
    vi.spyOn(BookmarksService, "getInstance").mockReturnValue({
      beginRewindSession,
    } as unknown as BookmarksService);
    const service = createService();
    const noobs = createNoobsApi();
    noobs.ListVideoEncoders.mockReturnValue(["obs_x264"]);
    const internals = service as unknown as {
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi>;
      status: ManagedRecorderStatus;
    };
    internals.noobs = noobs;
    internals.initialize = vi.fn().mockResolvedValue(undefined);
    internals.status = { ...service.getStatus(), activeGame: null };

    await service.startBuffer();

    expect(noobs.SetVideoEncoder).toHaveBeenCalledWith(
      "obs_x264",
      expect.objectContaining({
        rate_control: "CRF",
        crf: 26,
      }),
    );
    expect(beginRewindSession).toHaveBeenCalledWith(
      expect.objectContaining({ game: "poe1" }),
    );
  });

  it("configures selected audio input and output sources", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingAudioInputDeviceId: "{input-device}",
        recordingAudioOutputDeviceId: "{output-device}",
      }),
    } as unknown as SettingsStoreService);
    const service = createService();
    const noobs = createNoobsApi();
    noobs.CreateSource.mockImplementation((name: string) => `${name} Source`);
    noobs.GetSourceSettings.mockReturnValue({ existing: true });
    const internals = service as unknown as {
      configureAudioSources(): void;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;

    internals.configureAudioSources();

    expect(noobs.CreateSource).toHaveBeenCalledWith(
      "Hinekora Audio Output",
      "wasapi_output_capture",
    );
    expect(noobs.CreateSource).toHaveBeenCalledWith(
      "Hinekora Audio Input",
      "wasapi_input_capture",
    );
    expect(noobs.SetSourceSettings).toHaveBeenCalledWith(
      "Hinekora Audio Output Source",
      expect.objectContaining({
        existing: true,
        device_id: "{output-device}",
      }),
    );
    expect(noobs.SetSourceSettings).toHaveBeenCalledWith(
      "Hinekora Audio Input Source",
      expect.objectContaining({
        existing: true,
        device_id: "{input-device}",
      }),
    );
    expect(noobs.SetSourceVolume).toHaveBeenCalledWith(
      "Hinekora Audio Output Source",
      1,
    );
    expect(noobs.SetSourceVolume).toHaveBeenCalledWith(
      "Hinekora Audio Input Source",
      1,
    );
    expect(noobs.AddSourceToScene).toHaveBeenCalledWith(
      "Hinekora Audio Output Source",
    );
    expect(noobs.AddSourceToScene).toHaveBeenCalledWith(
      "Hinekora Audio Input Source",
    );

    noobs.CreateSource.mockClear();
    noobs.SetSourceSettings.mockClear();
    noobs.SetSourceVolume.mockClear();
    noobs.AddSourceToScene.mockClear();
    noobs.RemoveSourceFromScene.mockClear();
    noobs.DeleteSource.mockClear();

    internals.configureAudioSources();

    expect(noobs.CreateSource).not.toHaveBeenCalled();
    expect(noobs.SetSourceSettings).not.toHaveBeenCalled();
    expect(noobs.SetSourceVolume).not.toHaveBeenCalled();
    expect(noobs.AddSourceToScene).not.toHaveBeenCalled();

    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => createDefaultSettings(),
    } as unknown as SettingsStoreService);

    internals.configureAudioSources();

    expect(noobs.RemoveSourceFromScene).toHaveBeenCalledWith(
      "Hinekora Audio Output Source",
    );
    expect(noobs.RemoveSourceFromScene).toHaveBeenCalledWith(
      "Hinekora Audio Input Source",
    );
    expect(noobs.DeleteSource).toHaveBeenCalledWith(
      "Hinekora Audio Output Source",
    );
    expect(noobs.DeleteSource).toHaveBeenCalledWith(
      "Hinekora Audio Input Source",
    );
  });

  it("throws when selected audio devices cannot be configured by OBS runtime", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingAudioOutputDeviceId: "{output-device}",
      }),
    } as unknown as SettingsStoreService);
    const service = createService();
    const noobs = createNoobsApi();
    delete (noobs as Partial<ReturnType<typeof createNoobsApi>>)
      .GetSourceSettings;
    const internals = service as unknown as {
      configureAudioSources(): void;
      noobs: Partial<ReturnType<typeof createNoobsApi>>;
    };
    internals.noobs = noobs;

    expect(() => internals.configureAudioSources()).toThrow(
      "Packaged OBS runtime cannot configure audio sources",
    );
  });

  it("lists audio devices through OBS audio source probes", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    noobs.CreateSource.mockImplementation((name: string) => name);
    noobs.GetSourceProperties.mockImplementation((sourceName: string) => [
      {
        name: "device_id",
        items: sourceName.includes("Input")
          ? [
              { name: "Default", value: "default" },
              { name: "Microphone", value: "{mic-device}" },
            ]
          : [
              { name: "Default", value: "default" },
              { name: "Headphones", value: "{output-device}" },
            ],
      },
    ]);
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockResolvedValue(join(directory, "runtime"));

    await expect(service.listAudioDevices()).resolves.toEqual({
      input: [
        { id: "default", label: "Default" },
        { id: "{mic-device}", label: "Microphone" },
      ],
      output: [
        { id: "default", label: "Default" },
        { id: "{output-device}", label: "Headphones" },
      ],
    });
    expect(noobs.CreateSource).toHaveBeenCalledWith(
      "Hinekora Audio Input Probe",
      "wasapi_input_capture",
    );
    expect(noobs.CreateSource).toHaveBeenCalledWith(
      "Hinekora Audio Output Probe",
      "wasapi_output_capture",
    );
    expect(noobs.DeleteSource).toHaveBeenCalledWith(
      "Hinekora Audio Input Probe",
    );
    expect(noobs.DeleteSource).toHaveBeenCalledWith(
      "Hinekora Audio Output Probe",
    );

    await service.listAudioDevices();
    expect(noobs.CreateSource).toHaveBeenCalledTimes(2);

    await service.listAudioDevices({ forceRefresh: true });
    expect(noobs.CreateSource).toHaveBeenCalledTimes(4);
  });

  it("shares an in-flight audio device list request", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    let resolveRuntime!: (runtimePath: string) => void;
    noobs.CreateSource.mockImplementation((name: string) => name);
    noobs.GetSourceProperties.mockImplementation((sourceName: string) => [
      {
        name: "device_id",
        items: sourceName.includes("Output")
          ? [{ name: "Headphones", value: "{output-device}" }]
          : [],
      },
    ]);
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.ensureNoobsRuntimeInitialized = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolveInitialize) => {
          resolveRuntime = resolveInitialize;
        }),
    );

    const firstRequest = service.listAudioDevices();
    const secondRequest = service.listAudioDevices({ forceRefresh: true });
    resolveRuntime(join(directory, "runtime"));

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      {
        input: [],
        output: [{ id: "{output-device}", label: "Headphones" }],
      },
      {
        input: [],
        output: [{ id: "{output-device}", label: "Headphones" }],
      },
    ]);
    expect(internals.ensureNoobsRuntimeInitialized).toHaveBeenCalledTimes(1);
  });

  it("falls back to empty and cached audio devices when probing fails", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    noobs.CreateSource.mockImplementation((name: string) => name);
    noobs.GetSourceProperties.mockImplementation((sourceName: string) => [
      {
        name: "device_id",
        items: sourceName.includes("Output")
          ? [{ name: "Headphones", value: "{output-device}" }]
          : [],
      },
    ]);
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockRejectedValueOnce(new Error("runtime missing"))
      .mockResolvedValueOnce(join(directory, "runtime"))
      .mockRejectedValueOnce(new Error("runtime unavailable"));

    await expect(
      service.listAudioDevices({ forceRefresh: true }),
    ).resolves.toEqual({
      input: [],
      output: [],
    });
    await expect(
      service.listAudioDevices({ forceRefresh: true }),
    ).resolves.toEqual({
      input: [],
      output: [{ id: "{output-device}", label: "Headphones" }],
    });
    await expect(
      service.listAudioDevices({ forceRefresh: true }),
    ).resolves.toEqual({
      input: [],
      output: [{ id: "{output-device}", label: "Headphones" }],
    });
  });

  it("returns empty audio devices when OBS audio source APIs are unavailable", async () => {
    vi.useFakeTimers();
    const service = createService();
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: Partial<ReturnType<typeof createNoobsApi>>;
    };
    internals.noobs = {};
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockResolvedValue(join(directory, "runtime"));

    const request = service.listAudioDevices({ forceRefresh: true });
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual({
      input: [],
      output: [],
    });
  });

  it("throttles repeated empty audio device probes until explicit refresh", async () => {
    const service = createService();
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: Partial<ReturnType<typeof createNoobsApi>>;
      waitForAudioDeviceProbeRetry(): Promise<void>;
    };
    internals.noobs = {};
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockResolvedValue(join(directory, "runtime"));
    internals.waitForAudioDeviceProbeRetry = vi
      .fn()
      .mockResolvedValue(undefined);

    await expect(service.listAudioDevices()).resolves.toEqual({
      input: [],
      output: [],
    });
    await expect(service.listAudioDevices()).resolves.toEqual({
      input: [],
      output: [],
    });
    expect(internals.ensureNoobsRuntimeInitialized).toHaveBeenCalledTimes(1);

    await expect(
      service.listAudioDevices({ forceRefresh: true }),
    ).resolves.toEqual({
      input: [],
      output: [],
    });
    expect(internals.ensureNoobsRuntimeInitialized).toHaveBeenCalledTimes(2);
  });

  it("does not delete audio probes when source creation fails", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    noobs.CreateSource.mockImplementation(() => {
      throw new Error("create failed");
    });
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: ReturnType<typeof createNoobsApi>;
      waitForAudioDeviceProbeRetry(): Promise<void>;
    };
    internals.noobs = noobs;
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockResolvedValue(join(directory, "runtime"));
    internals.waitForAudioDeviceProbeRetry = vi
      .fn()
      .mockResolvedValue(undefined);

    await expect(
      service.listAudioDevices({ forceRefresh: true }),
    ).resolves.toEqual({
      input: [],
      output: [],
    });
    expect(noobs.DeleteSource).not.toHaveBeenCalled();
  });

  it("retries and avoids caching empty audio output probe results", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    noobs.CreateSource.mockImplementation((name: string) => name);
    noobs.GetSourceProperties.mockImplementation((sourceName: string) => [
      {
        name: "device_id",
        items:
          sourceName.includes("Output") &&
          noobs.GetSourceProperties.mock.calls.filter(([name]) =>
            name.includes("Output"),
          ).length > 1
            ? [{ name: "Headphones", value: "{output-device}" }]
            : [],
      },
    ]);
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: ReturnType<typeof createNoobsApi>;
      waitForAudioDeviceProbeRetry(): Promise<void>;
    };
    internals.noobs = noobs;
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockResolvedValue(join(directory, "runtime"));
    internals.waitForAudioDeviceProbeRetry = vi
      .fn()
      .mockResolvedValue(undefined);

    await expect(service.listAudioDevices()).resolves.toEqual({
      input: [],
      output: [{ id: "{output-device}", label: "Headphones" }],
    });
    expect(internals.waitForAudioDeviceProbeRetry).toHaveBeenCalled();
    expect(noobs.CreateSource).toHaveBeenCalledTimes(4);

    await service.listAudioDevices();
    expect(noobs.CreateSource).toHaveBeenCalledTimes(4);
  });

  it("lists audio devices without publishing recorder initialized status", async () => {
    const runtimePath = join(directory, "runtime");
    mkdirSync(runtimePath, { recursive: true });
    process.env.HINEKORA_NOOBS_PATH = runtimePath;
    const service = createService();
    const noobs = createNoobsApi();
    noobsMocks.loadNoobsApi.mockResolvedValue(noobs);
    noobs.CreateSource.mockImplementation((name: string) => name);
    noobs.GetSourceProperties.mockImplementation((sourceName: string) => [
      {
        name: "device_id",
        items: sourceName.includes("Input")
          ? [{ name: "Microphone", value: "{mic-device}" }]
          : [{ name: "Headphones", value: "{output-device}" }],
      },
    ]);

    send.mockClear();

    await expect(service.listAudioDevices()).resolves.toEqual({
      input: [{ id: "{mic-device}", label: "Microphone" }],
      output: [{ id: "{output-device}", label: "Headphones" }],
    });

    expect(noobs.Init).toHaveBeenCalledWith(
      runtimePath,
      join(directory, "managed-recorder-logs"),
      expect.any(Function),
    );
    expect(noobs.SetBuffering).toHaveBeenCalledWith(true);
    expect(service.getStatus()).toMatchObject({
      available: true,
      initialized: false,
      runtimePath,
    });
    expect(send).not.toHaveBeenCalled();

    const internals = service as unknown as {
      initialize(): Promise<void>;
    };
    noobs.Init.mockClear();

    await internals.initialize();

    expect(noobs.Init).not.toHaveBeenCalled();
    expect(service.getStatus()).toMatchObject({
      initialized: true,
      error: null,
    });
  });

  it("starts and stops full run recordings while registering saved runs", async () => {
    const savedPath = join(directory, "run.mp4");
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        recordingStoragePath: directory,
        recordingFps: 60,
        recordingOutputResolution: "2560x1440",
        recordingEncoder: "hardware_av1",
      }),
    } as unknown as SettingsStoreService);
    const service = createService();
    const noobs = createNoobsApi();
    noobs.ListVideoEncoders.mockReturnValue([
      "obs_nvenc_av1_tex",
      "h264_texture_amf",
      "obs_x264",
    ]);
    noobs.GetLastRecording.mockReturnValue(savedPath);
    const registeredRecording = {
      createdAt: "2026-07-03T20:00:00.000Z",
      durationSeconds: 30,
      exists: true,
      fileName: "run.mp4",
      id: "registered-run",
      path: savedPath,
      sizeBytes: 1024,
      sourceGame: "poe1" as const,
      sourceLeague: "Runes of Aldur",
      startedAt: "2026-07-03T20:00:00.000Z",
      stoppedAt: "2026-07-03T20:00:30.000Z",
      updatedAt: "2026-07-03T20:00:30.000Z",
    };
    const beginRecordingSession = vi.fn();
    const finalizeRecordingSession = vi.fn();
    vi.spyOn(BookmarksService, "getInstance").mockReturnValue({
      beginRecordingSession,
      discardRecordingSession: vi.fn(),
      finalizeRecordingSession,
    } as unknown as BookmarksService);
    const registerRunRecording = vi.fn(() => ({ id: registeredRecording.id }));
    const getRecording = vi.fn(() => ({ recording: registeredRecording }));
    const cleanup = vi.fn();
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
      getRecording,
      registerRunRecording,
    } as unknown as RecordingStorageService);
    const internals = service as unknown as {
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi>;
      status: ManagedRecorderStatus;
      waitForRecordingStop(): Promise<void>;
      waitForSavedRecording(): Promise<string | null>;
    };
    internals.noobs = noobs;
    internals.initialize = vi.fn().mockResolvedValue(undefined);
    internals.waitForRecordingStop = vi.fn().mockResolvedValue(undefined);
    internals.waitForSavedRecording = vi.fn().mockResolvedValue(savedPath);
    internals.status = { ...service.getStatus(), activeGame: null };

    await expect(service.startRunRecording()).resolves.toMatchObject({
      recording: true,
      runRecordingActive: true,
      bufferActive: false,
      activeGame: "poe1",
      activeSessionDirectory: join(directory, "Full Recordings"),
      outputResolution: "2560x1440",
      encoder: "obs_nvenc_av1_tex",
      error: null,
    });
    expect(noobs.ResetVideoContext).toHaveBeenCalledWith(60, 2560, 1440);
    expect(noobs.SetVideoEncoder).toHaveBeenCalledWith(
      "obs_nvenc_av1_tex",
      expect.objectContaining({ rate_control: "CQP" }),
    );
    const runStartedAt = service.getStatus().runRecordingStartedAt;
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        activeLeague: "Runes of Aldur",
        recordingStoragePath: directory,
        recordingFps: 60,
        recordingOutputResolution: "1920x1080",
        recordingEncoder: "hardware_h264",
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "Default", game: "poe2" }),
          captureTarget: {
            kind: "display",
            id: "primary",
            label: "Primary display",
            width: 1920,
            height: 1080,
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    (service as unknown as { status: ManagedRecorderStatus }).status = {
      ...service.getStatus(),
      initialized: true,
    };

    await expect(service.stopRunRecording()).resolves.toMatchObject({
      recording: false,
      runRecordingActive: false,
      activeGame: null,
      lastRecordingPath: savedPath,
      runRecordingPath: savedPath,
      error: null,
    });

    expect(noobs.SetBuffering).toHaveBeenCalledWith(false);
    expect(noobs.StartRecording).toHaveBeenCalledWith(0);
    expect(noobs.StopRecording).toHaveBeenCalled();
    expect(beginRecordingSession).toHaveBeenCalledWith(
      expect.objectContaining({
        game: "poe1",
        league: "Standard",
      }),
    );
    expect(registerRunRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        path: savedPath,
        startedAt: runStartedAt,
        sourceGame: "poe1",
        sourceLeague: "Runes of Aldur",
      }),
    );
    expect(getRecording).toHaveBeenCalledWith(registeredRecording.id);
    expect(finalizeRecordingSession).toHaveBeenCalledWith(registeredRecording);
    expect(cleanup).toHaveBeenCalledWith({
      protectedDirectories: [],
      protectedPaths: [savedPath],
    });
  });

  it("registers saved run recordings with the configured game when session game is missing", async () => {
    const savedPath = join(directory, "run-fallback.mp4");
    const startedAt = new Date(Date.now() - 30_000).toISOString();
    const service = createService();
    const noobs = createNoobsApi();
    const registerRunRecording = vi.fn();
    const cleanup = vi.fn();
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
      registerRunRecording,
    } as unknown as RecordingStorageService);
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        activeLeague: "Runes of Aldur",
        recordingStoragePath: directory,
        recordingFps: 60,
        recordingOutputResolution: "1920x1080",
        recordingEncoder: "hardware_h264",
      }),
    } as unknown as SettingsStoreService);
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      status: ManagedRecorderStatus;
      waitForRecordingStop(): Promise<void>;
      waitForSavedRecording(): Promise<string | null>;
    };
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeGame: null,
      activeSessionDirectory: directory,
      initialized: true,
      recording: true,
      runRecordingActive: true,
      runRecordingStartedAt: startedAt,
    };
    internals.waitForRecordingStop = vi.fn().mockResolvedValue(undefined);
    internals.waitForSavedRecording = vi.fn().mockResolvedValue(savedPath);

    await expect(service.stopRunRecording()).resolves.toMatchObject({
      activeGame: null,
      recording: false,
      runRecordingActive: false,
      runRecordingPath: savedPath,
    });

    expect(registerRunRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        path: savedPath,
        sourceGame: "poe2",
        sourceLeague: "Runes of Aldur",
        startedAt,
      }),
    );
    expect(cleanup).toHaveBeenCalledWith({
      protectedDirectories: [],
      protectedPaths: [savedPath],
    });
  });

  it("stops replay buffers without saving the active buffer", async () => {
    const previousPath = join(directory, "previous.mp4");
    const service = createService();
    const noobs = createNoobsApi();
    const cleanup = vi.fn();
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
    } as unknown as RecordingStorageService);
    const startedAt = new Date(Date.now() - 5_000).toISOString();
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      status: ManagedRecorderStatus;
      waitForRecordingStop(): Promise<void>;
    };
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      activeGame: "poe1",
      bufferActive: true,
      initialized: true,
      lastRecordingPath: previousPath,
      recording: true,
      recordingStartedAt: startedAt,
    };
    internals.waitForRecordingStop = vi.fn().mockResolvedValue(undefined);

    await expect(service.stopBuffer()).resolves.toMatchObject({
      bufferActive: false,
      recording: false,
      lastRecordingPath: previousPath,
      activeGame: null,
      activeSessionDirectory: null,
      error: null,
    });

    expect(noobs.StopRecording).toHaveBeenCalled();
    expect(noobs.StartRecording).not.toHaveBeenCalled();
    expect(noobs.GetLastRecording).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledWith({
      protectedDirectories: [],
      protectedPaths: [],
    });
  });

  it("reports stop-buffer failures without dropping active state", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      status: ManagedRecorderStatus;
      waitForRecordingStop(): Promise<void>;
    };
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      bufferActive: true,
      initialized: true,
      recording: true,
      recordingStartedAt: new Date().toISOString(),
    };
    internals.waitForRecordingStop = vi
      .fn()
      .mockRejectedValue(new Error("stuck"));

    await expect(service.stopBuffer()).resolves.toMatchObject({
      bufferActive: true,
      isStoppingRecording: false,
      error: "stuck",
    });
  });

  it("stops replay buffers even when no packaged recorder is active", async () => {
    const service = createService();
    const cleanup = vi.fn();
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
    } as unknown as RecordingStorageService);
    const internals = service as unknown as {
      noobs: null;
      status: ManagedRecorderStatus;
    };
    internals.noobs = null;
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      bufferActive: true,
      initialized: false,
      recording: true,
      recordingStartedAt: new Date().toISOString(),
    };

    await expect(service.stopBuffer()).resolves.toMatchObject({
      bufferActive: false,
      recording: false,
      activeSessionDirectory: null,
      error: null,
    });
    expect(cleanup).toHaveBeenCalledWith({
      protectedDirectories: [],
      protectedPaths: [],
    });
  });

  it("waits for an active replay save before stopping rewind when the game closes", async () => {
    pollerMocks.refreshPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    const service = createService();
    const internals = service as unknown as {
      activeReplaySaveRequest: Promise<{
        ok: boolean;
        path: string | null;
        error: string | null;
      }> | null;
      status: ManagedRecorderStatus;
    };
    let resolveReplaySave!: (result: {
      ok: boolean;
      path: string | null;
      error: string | null;
    }) => void;
    internals.activeReplaySaveRequest = new Promise((resolveSave) => {
      resolveReplaySave = resolveSave;
    });
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      bufferActive: true,
      gameRunning: true,
      initialized: true,
      recording: true,
      recordingStartedAt: new Date().toISOString(),
    };
    const stopBuffer = vi
      .spyOn(service, "stopBuffer")
      .mockImplementation(async () => {
        internals.status = {
          ...internals.status,
          bufferActive: false,
          recording: false,
        };
        return internals.status;
      });

    const offlineStop = service.setGameRunningState(false);
    await Promise.resolve();
    expect(stopBuffer).not.toHaveBeenCalled();

    resolveReplaySave({
      ok: true,
      path: join(directory, "clip.mp4"),
      error: null,
    });
    await expect(offlineStop).resolves.toBe(false);
    expect(stopBuffer).toHaveBeenCalledTimes(1);
  });

  it("stops full run recordings when the active game closes", async () => {
    pollerMocks.refreshPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      gameRunning: true,
      initialized: true,
      recording: true,
      runRecordingActive: true,
      runRecordingStartedAt: new Date().toISOString(),
    };
    const stopRunRecording = vi
      .spyOn(service, "stopRunRecording")
      .mockImplementation(async () => {
        internals.status = {
          ...internals.status,
          recording: false,
          runRecordingActive: false,
        };
        return internals.status;
      });

    await expect(service.setGameRunningState(false)).resolves.toBe(false);
    expect(stopRunRecording).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous game-running state when the lookup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    pollerMocks.refreshPoeProcessState.mockRejectedValue(
      new Error("process check failed"),
    );
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
    };

    await expect(
      service.refreshGameRunningStatus({ forceRefresh: true }),
    ).resolves.toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARN [managed-recorder] Active game running check failed",
      ),
      { error: "process check failed" },
    );
  });

  it("clears stale game-running state when the forced direct lookup misses", async () => {
    pollerMocks.refreshPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
    };

    await expect(
      service.refreshGameRunningStatus({ forceRefresh: true }),
    ).resolves.toBe(false);
    expect(service.getStatus()).toMatchObject({ gameRunning: false });
  });

  it("does not carry a running state across active game changes", async () => {
    pollerMocks.refreshPoeProcessState.mockResolvedValue({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    let settings: AppSettings = {
      ...createDefaultSettings(),
      activeGame: "poe1",
      recordingAutoStartMode: "recording",
      recordingStoragePath: directory,
    };
    const settingsChangeListeners: Array<(settings: AppSettings) => void> = [];
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
      onDidChange: (listener: (settings: AppSettings) => void) => {
        settingsChangeListeners.push(listener);

        return vi.fn();
      },
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
    };
    const startRunRecording = vi
      .spyOn(service, "startRunRecording")
      .mockResolvedValue(internals.status);

    settings = {
      ...settings,
      activeGame: "poe2",
    };
    expect(settingsChangeListeners).toHaveLength(1);
    settingsChangeListeners[0]!(settings);

    await vi.waitFor(() => {
      expect(pollerMocks.refreshPoeProcessState).toHaveBeenCalledWith("poe2");
    });
    await vi.waitFor(() => {
      expect(service.getStatus()).toMatchObject({ gameRunning: false });
    });
    expect(startRunRecording).not.toHaveBeenCalled();
  });

  it("reuses an in-flight game-running refresh", async () => {
    let resolveProcessState!: (state: {
      game?: GameId;
      isRunning: boolean;
      processName: string;
    }) => void;
    pollerMocks.refreshPoeProcessState.mockImplementation(
      () =>
        new Promise<{
          game?: GameId;
          isRunning: boolean;
          processName: string;
        }>((resolve) => {
          resolveProcessState = resolve;
        }),
    );
    const service = createService();

    const first = service.refreshGameRunningStatus({ forceRefresh: true });
    const second = service.refreshGameRunningStatus({ forceRefresh: false });

    expect(pollerMocks.refreshPoeProcessState).toHaveBeenCalledTimes(1);
    resolveProcessState({ isRunning: false, processName: "" });
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
  });

  it("starts a fresh forced game-running refresh and ignores the stale earlier result", async () => {
    const resolvers: Array<
      (state: {
        game?: GameId;
        isRunning: boolean;
        processName: string;
      }) => void
    > = [];
    pollerMocks.refreshPoeProcessState.mockImplementation(
      () =>
        new Promise<{
          game?: GameId;
          isRunning: boolean;
          processName: string;
        }>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const service = createService();

    const staleRefresh = service.refreshGameRunningStatus({
      forceRefresh: false,
    });
    const forcedRefresh = service.refreshGameRunningStatus({
      forceRefresh: true,
    });

    expect(pollerMocks.refreshPoeProcessState).toHaveBeenCalledTimes(2);
    resolvers[1]!({
      game: "poe1",
      isRunning: true,
      processName: "PathOfExileSteam.exe",
    });
    await expect(forcedRefresh).resolves.toBe(true);
    expect(service.getStatus()).toMatchObject({ gameRunning: true });

    resolvers[0]!({ isRunning: false, processName: "" });
    await expect(staleRefresh).resolves.toBe(true);
    expect(service.getStatus()).toMatchObject({ gameRunning: true });
  });

  it("updates game-running state directly from the process monitor", async () => {
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      error: "Path of Exile 1 is not running",
      gameRunning: false,
    };

    await expect(service.setGameRunningState(true)).resolves.toBe(true);

    expect(service.getStatus()).toMatchObject({
      error: null,
      gameRunning: true,
    });
  });

  it("starts the configured rewind buffer on app startup", async () => {
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = createService();
    const status = service.getStatus();
    const startBuffer = vi
      .spyOn(service, "startBuffer")
      .mockResolvedValue(status);

    service.initializeAutoStart();

    await vi.waitFor(() => {
      expect(startBuffer).toHaveBeenCalledTimes(1);
    });
  });

  it("waits for the process monitor instead of starting on app startup when the game is missing", async () => {
    pollerMocks.refreshPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    const startBuffer = vi
      .spyOn(service, "startBuffer")
      .mockResolvedValue(internals.status);

    service.initializeAutoStart();
    await vi.waitFor(() => {
      expect(pollerMocks.refreshPoeProcessState).toHaveBeenCalled();
    });

    expect(startBuffer).not.toHaveBeenCalled();
    expect(internals.status.gameRunning).toBe(false);
    expect(internals.status.error).not.toBe("Path of Exile 1 is not running");
  });

  it("starts the configured full recording when the active game appears", async () => {
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "recording",
      recordingStoragePath: directory,
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = createService();
    const startRunRecording = vi
      .spyOn(service, "startRunRecording")
      .mockResolvedValue(service.getStatus());
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: false,
    };

    await expect(service.setGameRunningState(true)).resolves.toBe(true);
    await expect(service.setGameRunningState(true)).resolves.toBe(true);

    expect(startRunRecording).toHaveBeenCalledTimes(1);
  });

  it("retries automatic startup when the selected window is not available yet", async () => {
    vi.useFakeTimers();
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
      selectedCaptureProfileId: "profile-1",
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "PoE 1", game: "poe1" }),
          id: "profile-1",
          captureTarget: {
            kind: "window",
            id: "window:poe:previous",
            label: "Path of Exile",
            game: "poe1",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockResolvedValue(join(directory, "runtime"));
    noobs.GetSourceProperties.mockReturnValueOnce([
      { name: "window", items: [] },
    ]);
    noobs.GetSourceProperties.mockReturnValue([
      {
        name: "window",
        items: [{ name: "Path of Exile", value: "window:poe:live" }],
      },
    ]);

    await service.setGameRunningState(true);
    expect(service.getStatus()).toMatchObject({
      error: "Selected capture window is not available yet",
      recording: false,
    });
    expect(noobs.DeleteSource).toHaveBeenCalledWith("source-1");
    expect(noobs.StartBuffer).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_500);

    await vi.waitFor(() => {
      expect(noobs.StartBuffer).toHaveBeenCalledTimes(1);
    });
    expect(service.getStatus()).toMatchObject({
      error: null,
      recording: true,
    });
  });

  it("logs automatic startup failures during initialization", async () => {
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    const service = createService();
    const internals = service as unknown as {
      attemptConfiguredAutoStartWhenGameRunning(): Promise<ManagedRecorderStatus | null>;
    };
    internals.attemptConfiguredAutoStartWhenGameRunning = vi
      .fn()
      .mockRejectedValue(new Error("startup failed"));

    service.initializeAutoStart();

    await vi.waitFor(() => {
      expect(logWarn).toHaveBeenCalledWith(
        "managed-recorder",
        "Automatic recorder startup failed",
        { error: "startup failed" },
      );
    });
  });

  it("short-circuits automatic startup when disabled, offline, or already active", async () => {
    let settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "off",
      recordingStoragePath: directory,
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      attemptConfiguredAutoStart(
        reason: "game-running" | "settings-changed" | "startup",
      ): Promise<ManagedRecorderStatus | null>;
      attemptConfiguredAutoStartWhenGameRunning(
        reason: "game-running" | "settings-changed" | "startup",
      ): Promise<ManagedRecorderStatus | null>;
      status: ManagedRecorderStatus;
    };

    await expect(
      internals.attemptConfiguredAutoStartWhenGameRunning("startup"),
    ).resolves.toBeNull();

    settings = {
      ...settings,
      recordingAutoStartMode: "rewind",
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: false,
    };
    await expect(
      internals.attemptConfiguredAutoStart("startup"),
    ).resolves.toBeNull();

    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
      recording: true,
    };
    await expect(internals.attemptConfiguredAutoStart("startup")).resolves.toBe(
      internals.status,
    );
    await expect(
      internals.attemptConfiguredAutoStartWhenGameRunning("startup"),
    ).resolves.toBe(internals.status);
  });

  it("logs automatic startup recheck failures after an in-flight start", async () => {
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      attemptConfiguredAutoStart(
        reason: "game-running" | "settings-changed" | "startup",
      ): Promise<ManagedRecorderStatus | null>;
      attemptConfiguredAutoStartWhenGameRunning(): Promise<ManagedRecorderStatus | null>;
      autoStartRequestNeedsRecheck: boolean;
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
    };
    let resolveStart!: (status: ManagedRecorderStatus) => void;
    vi.spyOn(service, "startBuffer").mockImplementation(
      () =>
        new Promise<ManagedRecorderStatus>((resolve) => {
          resolveStart = resolve;
        }),
    );

    const startRequest = internals.attemptConfiguredAutoStart("startup");
    await vi.waitFor(() => {
      expect(service.startBuffer).toHaveBeenCalledTimes(1);
    });

    internals.autoStartRequestNeedsRecheck = true;
    internals.attemptConfiguredAutoStartWhenGameRunning = vi
      .fn()
      .mockRejectedValue(new Error("recheck failed"));
    resolveStart(internals.status);
    await startRequest;

    await vi.waitFor(() => {
      expect(logWarn).toHaveBeenCalledWith(
        "managed-recorder",
        "Automatic recorder startup recheck failed",
        { error: "recheck failed" },
      );
    });
  });

  it("schedules, skips, clears, and logs automatic startup retries", async () => {
    vi.useFakeTimers();
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    const service = createService();
    const internals = service as unknown as {
      attemptConfiguredAutoStartWhenGameRunning(): Promise<ManagedRecorderStatus | null>;
      autoStartRetryTimer: NodeJS.Timeout | null;
      clearAutoStartRetry(): void;
      scheduleAutoStartRetry(
        reason: "game-running" | "settings-changed" | "startup",
      ): void;
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: false,
    };

    internals.scheduleAutoStartRetry("startup");
    expect(internals.autoStartRetryTimer).toBeNull();

    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
    };
    internals.attemptConfiguredAutoStartWhenGameRunning = vi
      .fn()
      .mockRejectedValue(new Error("retry failed"));
    internals.scheduleAutoStartRetry("startup");
    const timer = internals.autoStartRetryTimer;
    expect(timer).not.toBeNull();

    internals.scheduleAutoStartRetry("startup");
    expect(internals.autoStartRetryTimer).toBe(timer);

    internals.clearAutoStartRetry();
    expect(internals.autoStartRetryTimer).toBeNull();
    internals.scheduleAutoStartRetry("startup");

    await vi.advanceTimersByTimeAsync(2_500);

    await vi.waitFor(() => {
      expect(logWarn).toHaveBeenCalledWith(
        "managed-recorder",
        "Automatic recorder startup retry failed",
        { error: "retry failed" },
      );
    });
    expect(internals.autoStartRetryTimer).toBeNull();
  });

  it("starts the configured recorder mode when automatic startup is enabled", async () => {
    let settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "off",
      recordingStoragePath: directory,
    };
    const settingsChangeListeners: Array<(settings: AppSettings) => void> = [];
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
      onDidChange: (listener: (settings: AppSettings) => void) => {
        settingsChangeListeners.push(listener);

        return vi.fn();
      },
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    const startBuffer = vi
      .spyOn(service, "startBuffer")
      .mockResolvedValue(internals.status);
    settings = {
      ...settings,
      recordingAutoStartMode: "rewind",
    };

    expect(settingsChangeListeners).toHaveLength(1);
    settingsChangeListeners[0]!(settings);

    await vi.waitFor(() => {
      expect(startBuffer).toHaveBeenCalledTimes(1);
    });
  });

  it("clears pending automatic startup work when settings disable startup", () => {
    vi.useFakeTimers();
    let settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
    };
    const settingsChangeListeners: Array<(settings: AppSettings) => void> = [];
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
      onDidChange: (listener: (settings: AppSettings) => void) => {
        settingsChangeListeners.push(listener);

        return vi.fn();
      },
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      autoStartRequest: Promise<ManagedRecorderStatus | null> | null;
      autoStartRequestNeedsRecheck: boolean;
      autoStartRetryTimer: NodeJS.Timeout | null;
      scheduleAutoStartRetry(
        reason: "game-running" | "settings-changed" | "startup",
      ): void;
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
    };
    internals.scheduleAutoStartRetry("settings-changed");
    expect(internals.autoStartRetryTimer).not.toBeNull();
    internals.autoStartRequest = Promise.resolve(service.getStatus());

    settings = {
      ...settings,
      recordingAutoStartMode: "off",
    };
    expect(settingsChangeListeners).toHaveLength(1);
    settingsChangeListeners[0]!(settings);

    expect(internals.autoStartRequestNeedsRecheck).toBe(true);
    expect(internals.autoStartRetryTimer).toBeNull();
  });

  it("ignores unchanged automatic startup configuration and clears changed disabled configuration", () => {
    vi.useFakeTimers();
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "off",
      recordingStoragePath: directory,
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      attemptConfiguredAutoStartWhenGameRunning(): Promise<ManagedRecorderStatus | null>;
      autoStartRequest: Promise<ManagedRecorderStatus | null> | null;
      autoStartRequestNeedsRecheck: boolean;
      autoStartRetryTimer: NodeJS.Timeout | null;
      createAutoStartConfigurationKey(): string;
      handleAutoStartConfigurationChange(
        reason: "game-running" | "settings-changed" | "startup",
      ): void;
      previousAutoStartConfigurationKey: string;
      scheduleAutoStartRetry(
        reason: "game-running" | "settings-changed" | "startup",
      ): void;
      status: ManagedRecorderStatus;
    };
    internals.attemptConfiguredAutoStartWhenGameRunning = vi.fn();
    internals.previousAutoStartConfigurationKey =
      internals.createAutoStartConfigurationKey();

    internals.handleAutoStartConfigurationChange("settings-changed");

    expect(
      internals.attemptConfiguredAutoStartWhenGameRunning,
    ).not.toHaveBeenCalled();

    internals.status = {
      ...service.getStatus(),
      gameRunning: true,
    };
    internals.scheduleAutoStartRetry("settings-changed");
    internals.autoStartRequest = Promise.resolve(service.getStatus());
    internals.previousAutoStartConfigurationKey = "stale";

    internals.handleAutoStartConfigurationChange("settings-changed");

    expect(internals.autoStartRequestNeedsRecheck).toBe(true);
    expect(internals.autoStartRetryTimer).toBeNull();
  });

  it("logs automatic startup failures after configuration changes", async () => {
    const logWarn = vi.spyOn(AppLog, "logWarn").mockImplementation(() => {});
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
      selectedCaptureProfileId: "profile-1",
    };
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      attemptConfiguredAutoStartWhenGameRunning(): Promise<ManagedRecorderStatus | null>;
      handleAutoStartConfigurationChange(
        reason: "game-running" | "settings-changed" | "startup",
      ): void;
      previousAutoStartConfigurationKey: string;
    };
    internals.attemptConfiguredAutoStartWhenGameRunning = vi
      .fn()
      .mockRejectedValue(new Error("config failed"));
    internals.previousAutoStartConfigurationKey = "stale";

    internals.handleAutoStartConfigurationChange("settings-changed");

    await vi.waitFor(() => {
      expect(logWarn).toHaveBeenCalledWith(
        "managed-recorder",
        "Automatic recorder startup failed",
        { error: "config failed" },
      );
    });
  });

  it("rechecks automatic startup after settings change during an in-flight start", async () => {
    let settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
      selectedCaptureProfileId: "profile-1",
    };
    const settingsChangeListeners: Array<(settings: AppSettings) => void> = [];
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
      onDidChange: (listener: (settings: AppSettings) => void) => {
        settingsChangeListeners.push(listener);

        return vi.fn();
      },
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      autoStartRequestNeedsRecheck: boolean;
      status: ManagedRecorderStatus;
    };
    let resolveFirstStart!: (status: ManagedRecorderStatus) => void;
    const startBuffer = vi
      .spyOn(service, "startBuffer")
      .mockImplementationOnce(
        () =>
          new Promise<ManagedRecorderStatus>((resolve) => {
            resolveFirstStart = resolve;
          }),
      )
      .mockImplementationOnce(async () => internals.status);

    const firstStart = service.setGameRunningState(true);
    await vi.waitFor(() => {
      expect(startBuffer).toHaveBeenCalledTimes(1);
    });

    settings = {
      ...settings,
      selectedCaptureProfileId: "profile-2",
    };
    expect(settingsChangeListeners).toHaveLength(1);
    settingsChangeListeners[0]!(settings);
    await vi.waitFor(() => {
      expect(internals.autoStartRequestNeedsRecheck).toBe(true);
    });

    resolveFirstStart(internals.status);
    await firstStart;

    await vi.waitFor(() => {
      expect(startBuffer).toHaveBeenCalledTimes(2);
    });
  });

  it("re-evaluates automatic startup when the selected profile target changes", async () => {
    const settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "rewind",
      recordingStoragePath: directory,
      selectedCaptureProfileId: "profile-1",
    };
    const profileChangeListeners: Array<() => void> = [];
    let profiles: CaptureProfile[] = [
      {
        ...createDefaultCaptureProfile({ name: "PoE 1", game: "poe1" }),
        id: "profile-1",
        captureTarget: {
          kind: "display" as const,
          id: "primary",
          label: "Primary display",
        },
      },
    ];
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
      onDidChange: vi.fn(),
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => profiles,
      onDidChange: (listener: () => void) => {
        profileChangeListeners.push(listener);

        return vi.fn();
      },
    } as unknown as CaptureProfilesService);
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    const startBuffer = vi
      .spyOn(service, "startBuffer")
      .mockResolvedValue(internals.status);
    profiles = [
      {
        ...profiles[0]!,
        captureTarget: {
          kind: "window" as const,
          id: "window:poe:pending",
          label: "Path of Exile 1",
          game: "poe1" as const,
        },
      },
    ];

    expect(profileChangeListeners).toHaveLength(1);
    profileChangeListeners[0]!();

    await vi.waitFor(() => {
      expect(startBuffer).toHaveBeenCalledTimes(1);
    });
  });

  it("waits for the process monitor when automatic startup is enabled while the game is missing", async () => {
    pollerMocks.refreshPoeProcessState.mockResolvedValue({
      isRunning: false,
      processName: "",
    });
    let settings: AppSettings = {
      ...createDefaultSettings(),
      recordingAutoStartMode: "off",
      recordingStoragePath: directory,
    };
    const settingsChangeListeners: Array<(settings: AppSettings) => void> = [];
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => settings,
      onDidChange: (listener: (settings: AppSettings) => void) => {
        settingsChangeListeners.push(listener);

        return vi.fn();
      },
    } as unknown as SettingsStoreService);
    const service = createService();
    const internals = service as unknown as {
      status: ManagedRecorderStatus;
    };
    const startBuffer = vi
      .spyOn(service, "startBuffer")
      .mockResolvedValue(internals.status);
    settings = {
      ...settings,
      recordingAutoStartMode: "rewind",
    };

    expect(settingsChangeListeners).toHaveLength(1);
    settingsChangeListeners[0]!(settings);
    await vi.waitFor(() => {
      expect(pollerMocks.refreshPoeProcessState).toHaveBeenCalled();
    });

    expect(startBuffer).not.toHaveBeenCalled();
    expect(internals.status.gameRunning).toBe(false);
    expect(internals.status.error).not.toBe("Path of Exile 1 is not running");
  });

  it("reuses an active offline-stop request and logs stop failures", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const service = createService();
    const internals = service as unknown as {
      offlineStopRequest: Promise<void> | null;
      stopActiveRecordingForMissingGame(): Promise<void>;
      stopActiveRecordingForMissingGameOnce(): Promise<void>;
    };
    const activeRequest = Promise.resolve();
    internals.offlineStopRequest = activeRequest;

    await expect(
      internals.stopActiveRecordingForMissingGame(),
    ).resolves.toBeUndefined();
    expect(internals.offlineStopRequest).toBe(activeRequest);

    internals.offlineStopRequest = null;
    internals.stopActiveRecordingForMissingGameOnce = vi
      .fn()
      .mockRejectedValue(new Error("stop failed"));
    await expect(
      internals.stopActiveRecordingForMissingGame(),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        "ERROR [managed-recorder] Game-offline recorder stop failed",
      ),
      { error: "stop failed" },
    );
    expect(internals.offlineStopRequest).toBeNull();
  });

  it("clears only active game not-running errors", () => {
    const service = createService();
    const internals = service as unknown as {
      clearGameNotRunningError(): string | null;
      status: ManagedRecorderStatus;
    };
    internals.status = {
      ...service.getStatus(),
      error: "Path of Exile 1 is not running",
    };

    expect(internals.clearGameNotRunningError()).toBeNull();

    internals.status = {
      ...service.getStatus(),
      error: "Manual error",
    };
    expect(internals.clearGameNotRunningError()).toBe("Manual error");

    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        recordingStoragePath: directory,
      }),
    } as unknown as SettingsStoreService);
    const poe2Service = createService();
    const poe2Internals = poe2Service as unknown as {
      clearGameNotRunningError(): string | null;
      status: ManagedRecorderStatus;
    };
    poe2Internals.status = {
      ...poe2Service.getStatus(),
      error: "Path of Exile 2 is not running",
    };

    expect(poe2Internals.clearGameNotRunningError()).toBeNull();
  });

  it("reports startup failures without leaving recorder modes active", async () => {
    const service = createService();
    const internals = service as unknown as {
      initialize(): Promise<void>;
    };
    internals.initialize = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(service.startBuffer()).resolves.toMatchObject({
      bufferActive: false,
      recording: false,
      isStartingRecording: false,
      activeSessionDirectory: null,
      error: "boom",
    });
  });

  it("reports missing noobs after initialization seams succeed", async () => {
    const service = createService();
    const internals = service as unknown as {
      initialize(): Promise<void>;
      noobs: null;
    };
    internals.noobs = null;
    internals.initialize = vi.fn().mockResolvedValue(undefined);

    await expect(service.startBuffer()).resolves.toMatchObject({
      bufferActive: false,
      recording: false,
      error: "noobs module is not installed",
    });
  });

  it("fails replay saves when the buffer is inactive", async () => {
    const service = createService();
    const internals = service as unknown as {
      initialize(): Promise<void>;
      status: ManagedRecorderStatus;
    };
    internals.initialize = vi.fn().mockResolvedValue(undefined);
    internals.status = {
      ...service.getStatus(),
      bufferActive: false,
      recording: false,
    };

    await expect(service.saveReplay(10)).resolves.toEqual({
      ok: false,
      path: null,
      error: "Managed replay buffer is not active",
    });
  });

  it("reuses an in-flight replay save request", async () => {
    const service = createService();
    const savedPath = join(directory, "clip.mp4");
    const result = { ok: true, path: savedPath, error: null };
    let resolveReplay!: (saveResult: typeof result) => void;
    const internals = service as unknown as {
      activeReplaySaveRequest: Promise<unknown> | null;
      runSaveReplay(
        seconds: number,
        kind: "death" | "manual",
      ): Promise<typeof result>;
    };
    internals.runSaveReplay = vi.fn(
      () =>
        new Promise<typeof result>((resolveSave) => {
          resolveReplay = resolveSave;
        }),
    );

    const first = service.saveReplay(10);
    const second = service.saveReplay(12);

    expect(internals.runSaveReplay).toHaveBeenCalledTimes(1);
    expect(internals.runSaveReplay).toHaveBeenCalledWith(10, "death");
    resolveReplay(result);
    await expect(first).resolves.toEqual(result);
    await expect(second).resolves.toEqual(result);
    expect(internals.activeReplaySaveRequest).toBeNull();
  });

  it("does not clear a newer replay save request when a stale request finishes", async () => {
    const service = createService();
    const savedPath = join(directory, "clip.mp4");
    const result = { ok: true, path: savedPath, error: null };
    let resolveReplay!: (saveResult: typeof result) => void;
    const newerRequest = Promise.resolve({
      ok: false,
      path: null,
      error: "newer request",
    });
    const internals = service as unknown as {
      activeReplaySaveRequest: Promise<unknown> | null;
      runSaveReplay(
        seconds: number,
        kind: "death" | "manual",
      ): Promise<typeof result>;
    };
    internals.runSaveReplay = vi.fn(
      () =>
        new Promise<typeof result>((resolveSave) => {
          resolveReplay = resolveSave;
        }),
    );

    const staleRequest = service.saveReplay(10);
    internals.activeReplaySaveRequest = newerRequest;
    resolveReplay(result);

    await expect(staleRequest).resolves.toEqual(result);
    expect(internals.activeReplaySaveRequest).toBe(newerRequest);
    await newerRequest;
  });

  it("saves active replay buffers and restarts status", async () => {
    const savedPath = join(directory, "clip.mp4");
    const service = createService();
    const internals = service as unknown as {
      initialize(): Promise<void>;
      saveBufferedReplay(
        seconds: number,
        options: { kind: "death" | "manual"; restartBufferAfterSave: boolean },
      ): Promise<string>;
      status: ManagedRecorderStatus;
    };
    internals.initialize = vi.fn().mockResolvedValue(undefined);
    internals.saveBufferedReplay = vi.fn().mockResolvedValue(savedPath);
    internals.status = {
      ...service.getStatus(),
      activeGame: "poe2",
      bufferActive: true,
      recording: true,
    };

    await expect(service.saveReplay(12)).resolves.toEqual({
      ok: true,
      path: savedPath,
      error: null,
    });

    expect(internals.saveBufferedReplay).toHaveBeenCalledWith(12, {
      kind: "death",
      restartBufferAfterSave: true,
    });
    expect(service.getStatus()).toMatchObject({
      bufferActive: true,
      recording: true,
      activeGame: "poe2",
      lastRecordingPath: savedPath,
      error: null,
    });
  });

  it("uses the configured game when saving replay buffers without a session game", async () => {
    const savedPath = join(directory, "clip-fallback.mp4");
    const service = createService();
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        recordingStoragePath: directory,
        recordingFps: 60,
        recordingOutputResolution: "1920x1080",
        recordingEncoder: "hardware_h264",
      }),
    } as unknown as SettingsStoreService);
    const internals = service as unknown as {
      initialize(): Promise<void>;
      saveBufferedReplay(
        seconds: number,
        options: { kind: "death" | "manual"; restartBufferAfterSave: boolean },
      ): Promise<string>;
      status: ManagedRecorderStatus;
    };
    internals.initialize = vi.fn().mockResolvedValue(undefined);
    internals.saveBufferedReplay = vi.fn().mockResolvedValue(savedPath);
    internals.status = {
      ...service.getStatus(),
      activeGame: null,
      bufferActive: true,
      recording: true,
    };

    await expect(service.saveReplay(12)).resolves.toEqual({
      ok: true,
      path: savedPath,
      error: null,
    });

    expect(service.getStatus()).toMatchObject({
      activeGame: "poe2",
      bufferActive: true,
      recording: true,
      lastRecordingPath: savedPath,
    });
  });

  it("converts buffered replay recordings and resumes the replay buffer", async () => {
    const savedPath = join(directory, "clip.mp4");
    const service = createService();
    const noobs = createNoobsApi();
    const recordingStartedAt = new Date(Date.now() - 20_000).toISOString();
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      restartReplayBufferAfterSave(
        sessionDirectory: string,
        recordingStartedAt: string | null,
        activeGame: GameId | null,
      ): void;
      saveBufferedReplay(
        seconds: number,
        options: { kind: "death" | "manual"; restartBufferAfterSave: boolean },
      ): Promise<string>;
      status: ManagedRecorderStatus;
      stopReplayConversionRecording(path: string): Promise<void>;
      waitForRecordingFileDetection(
        outputDirectory: string,
        modifiedAfterMs: number,
        waitMs: number,
        ignoredPaths?: Set<string>,
      ): Promise<string | null>;
      waitForReplayConversionStopDelay(): Promise<void>;
      waitForStableRecordingFile(
        path: string,
        deadlineMs: number,
      ): Promise<boolean>;
    };
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeGame: "poe2",
      activeSessionDirectory: directory,
      recordingStartedAt,
      outputResolution: "1920x1080",
    };
    internals.waitForRecordingFileDetection = vi
      .fn()
      .mockResolvedValue(savedPath);
    internals.waitForReplayConversionStopDelay = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.stopReplayConversionRecording = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.waitForStableRecordingFile = vi.fn().mockResolvedValue(true);
    const restartReplayBufferAfterSave = vi.spyOn(
      internals,
      "restartReplayBufferAfterSave",
    );

    await expect(
      internals.saveBufferedReplay(999, {
        kind: "death",
        restartBufferAfterSave: true,
      }),
    ).resolves.toBe(savedPath);

    expect(noobs.StartRecording).toHaveBeenCalledWith(60);
    expect(noobs.SetRecordingCfg).toHaveBeenCalledTimes(1);
    expect(noobs.SetRecordingCfg).toHaveBeenCalledWith(directory, "mp4");
    expect(noobs.SetRecordingCfg.mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(internals.stopReplayConversionRecording).mock
        .invocationCallOrder[0] ?? 0,
    );
    expect(internals.waitForRecordingFileDetection).toHaveBeenCalledWith(
      directory,
      expect.any(Number),
      expect.any(Number),
      expect.any(Set),
    );
    expect(internals.stopReplayConversionRecording).toHaveBeenCalledWith(
      savedPath,
    );
    expect(restartReplayBufferAfterSave).toHaveBeenCalledWith(
      directory,
      recordingStartedAt,
      "poe2",
    );
  });

  it("reports replay conversion timeouts and unstable files", async () => {
    const savedPath = join(directory, "unstable.mp4");
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      saveBufferedReplay(
        seconds: number,
        options: { kind: "death" | "manual"; restartBufferAfterSave: boolean },
      ): Promise<string>;
      status: ManagedRecorderStatus;
      stopReplayConversionRecording(path: string): Promise<void>;
      waitForRecordingFileDetection(): Promise<string | null>;
      waitForReplayConversionStopDelay(): Promise<void>;
      waitForStableRecordingFile(
        path: string,
        deadlineMs: number,
      ): Promise<boolean>;
    };
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      recordingStartedAt: new Date().toISOString(),
      outputResolution: "1920x1080",
    };
    internals.waitForRecordingFileDetection = vi.fn().mockResolvedValue(null);

    await expect(
      internals.saveBufferedReplay(10, {
        kind: "death",
        restartBufferAfterSave: false,
      }),
    ).rejects.toThrow("Managed recorder did not write a recording file");

    internals.waitForRecordingFileDetection = vi
      .fn()
      .mockResolvedValue(savedPath);
    internals.waitForReplayConversionStopDelay = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.stopReplayConversionRecording = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.waitForStableRecordingFile = vi.fn().mockResolvedValue(false);

    await expect(
      internals.saveBufferedReplay(10, {
        kind: "death",
        restartBufferAfterSave: false,
      }),
    ).rejects.toThrow("Managed recorder did not finalize the recording file");
  });

  it("saves buffered replay recordings without restarting the replay buffer", async () => {
    const savedPath = join(directory, "clip-no-restart.mp4");
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      restartReplayBufferAfterSave(
        sessionDirectory: string,
        recordingStartedAt: string | null,
        activeGame: GameId | null,
      ): void;
      saveBufferedReplay(
        seconds: number,
        options: { kind: "death" | "manual"; restartBufferAfterSave: boolean },
      ): Promise<string>;
      status: ManagedRecorderStatus;
      stopReplayConversionRecording(path: string): Promise<void>;
      waitForRecordingFileDetection(): Promise<string | null>;
      waitForReplayConversionStopDelay(): Promise<void>;
      waitForStableRecordingFile(
        path: string,
        deadlineMs: number,
      ): Promise<boolean>;
    };
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      recordingStartedAt: new Date().toISOString(),
      outputResolution: "1920x1080",
    };
    internals.waitForRecordingFileDetection = vi
      .fn()
      .mockResolvedValue(savedPath);
    internals.waitForReplayConversionStopDelay = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.stopReplayConversionRecording = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.waitForStableRecordingFile = vi.fn().mockResolvedValue(true);
    const restartReplayBufferAfterSave = vi.spyOn(
      internals,
      "restartReplayBufferAfterSave",
    );

    await expect(
      internals.saveBufferedReplay(10, {
        kind: "death",
        restartBufferAfterSave: false,
      }),
    ).resolves.toBe(savedPath);
    expect(restartReplayBufferAfterSave).not.toHaveBeenCalled();
  });

  it("moves manual replay saves after conversion without reconfiguring active output", async () => {
    const activeDirectory = join(directory, "Death Clips");
    const manualDirectory = join(directory, "Manual Replays");
    const savedPath = join(activeDirectory, "manual-replay.mp4");
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      saveBufferedReplay(
        seconds: number,
        options: { kind: "death" | "manual"; restartBufferAfterSave: boolean },
      ): Promise<string>;
      status: ManagedRecorderStatus;
      stopReplayConversionRecording(path: string): Promise<void>;
      waitForRecordingFileDetection(): Promise<string | null>;
      waitForReplayConversionStopDelay(): Promise<void>;
      waitForStableRecordingFile(
        path: string,
        deadlineMs: number,
      ): Promise<boolean>;
    };
    mkdirSync(activeDirectory, { recursive: true });
    writeFileSync(savedPath, "video");
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: activeDirectory,
      recordingStartedAt: new Date().toISOString(),
      outputResolution: "1920x1080",
    };
    internals.waitForRecordingFileDetection = vi
      .fn()
      .mockResolvedValue(savedPath);
    internals.waitForReplayConversionStopDelay = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.stopReplayConversionRecording = vi
      .fn()
      .mockResolvedValue(undefined);
    internals.waitForStableRecordingFile = vi.fn().mockResolvedValue(true);

    await expect(
      internals.saveBufferedReplay(10, {
        kind: "manual",
        restartBufferAfterSave: false,
      }),
    ).resolves.toBe(join(manualDirectory, "manual-replay.mp4"));

    expect(noobs.SetRecordingCfg).not.toHaveBeenCalled();
    expect(existsSync(savedPath)).toBe(false);
    expect(existsSync(join(manualDirectory, "manual-replay.mp4"))).toBe(true);
  });

  it("waits for detected and finalized recording files", async () => {
    const savedPath = join(directory, "detected.mp4");
    const service = createService();
    const internals = service as unknown as {
      resolveSavedRecordingPath(
        outputDirectory: string,
        modifiedAfterMs: number,
        ignoredPaths?: Set<string>,
      ): string | null;
      waitForRecordingFileDetection(
        outputDirectory: string,
        modifiedAfterMs: number,
        waitMs: number,
        ignoredPaths?: Set<string>,
      ): Promise<string | null>;
      waitForRecordingFilePoll(): Promise<void>;
      waitForSavedRecording(
        outputDirectory: string,
        modifiedAfterMs: number,
        waitMs?: number,
        ignoredPaths?: Set<string>,
      ): Promise<string | null>;
      waitForStableRecordingFile(
        path: string,
        deadlineMs: number,
      ): Promise<boolean>;
    };
    let lookupCount = 0;
    internals.resolveSavedRecordingPath = vi.fn(() => {
      lookupCount += 1;
      return lookupCount > 1 ? savedPath : null;
    });
    internals.waitForRecordingFilePoll = vi.fn().mockResolvedValue(undefined);

    await expect(
      internals.waitForRecordingFileDetection(directory, 0, 1_000),
    ).resolves.toBe(savedPath);

    internals.resolveSavedRecordingPath = vi.fn(() => savedPath);
    internals.waitForStableRecordingFile = vi.fn().mockResolvedValue(true);
    await expect(
      internals.waitForSavedRecording(directory, 0, 1_000),
    ).resolves.toBe(savedPath);

    internals.waitForStableRecordingFile = vi.fn().mockResolvedValue(false);
    await expect(
      internals.waitForSavedRecording(directory, 0, 1_000),
    ).resolves.toBeNull();
  });

  it("configures capture sources and cleans stale sources defensively", () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      captureSourceKey: string | null;
      captureSourceName: string | null;
      configureCaptureSource(): void;
      createDisplaySourceSettings(
        sourceName: string,
        settings: Record<string, unknown>,
        target: unknown,
      ): Record<string, unknown>;
      noobs: ReturnType<typeof createNoobsApi>;
      removeCaptureSource(): void;
    };
    internals.noobs = noobs;

    internals.configureCaptureSource();
    expect(noobs.CreateSource).toHaveBeenCalledWith(
      "Hinekora Capture",
      expect.any(String),
    );
    expect(noobs.SetSourceSettings).toHaveBeenCalledWith(
      "source-1",
      expect.objectContaining({
        capture_cursor: true,
        force_sdr: false,
      }),
    );
    expect(noobs.AddSourceToScene).toHaveBeenCalledWith("source-1");

    noobs.CreateSource.mockClear();
    internals.configureCaptureSource();
    expect(noobs.CreateSource).not.toHaveBeenCalled();

    internals.captureSourceName = "source-1";
    internals.captureSourceKey = "display:old";
    internals.removeCaptureSource();
    expect(noobs.RemoveSourceFromScene).toHaveBeenCalledWith("source-1");
    expect(noobs.DeleteSource).toHaveBeenCalledWith("source-1");
  });

  it("throws when capture source helpers are unavailable", () => {
    const service = createService();
    const internals = service as unknown as {
      configureCaptureSource(): void;
      noobs: Partial<ReturnType<typeof createNoobsApi>>;
    };
    internals.noobs = {
      CreateSource: vi.fn(),
    };

    expect(() => internals.configureCaptureSource()).toThrow(
      "Packaged OBS runtime cannot configure capture sources",
    );
  });

  it("configures window capture source settings", () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      createWindowSourceSettings(
        sourceName: string,
        settings: Record<string, unknown>,
        target: unknown,
      ): Record<string, unknown>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    (noobs.GetSourceProperties as Mock<() => unknown[]>).mockReturnValue([
      {
        name: "method",
        items: [{ name: "Windows 10 (1903 and up)", value: 2 }],
      },
      {
        name: "window",
        items: [
          {
            name: "[PathOfExileSteam.exe]: Path of Exile 2",
            value: "Path of Exile 2:POEWindowClass:PathOfExileSteam.exe",
          },
        ],
      },
    ]);

    expect(
      internals.createWindowSourceSettings(
        "source-1",
        { existing: true },
        {
          kind: "window",
          id: "window:123:0",
          label: "Path of Exile 2",
        },
      ),
    ).toMatchObject({
      existing: true,
      method: 2,
      window: "Path of Exile 2:POEWindowClass:PathOfExileSteam.exe",
      client_area: true,
      force_sdr: false,
    });
  });

  it("fits active capture sources to the target canvas", () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      captureSourceName: string | null;
      captureSourceResolution: { width: number; height: number } | null;
      fitCaptureSourceToCanvas(canvas: { width: number; height: number }): void;
      noobs: ReturnType<typeof createNoobsApi>;
      readCaptureSourceResolution(
        sourceName: string,
      ): { width: number; height: number } | null;
      resolveCaptureTarget(): unknown;
    };
    internals.noobs = noobs;
    internals.captureSourceName = "source-1";
    noobs.GetSourcePos.mockReturnValue({
      x: 0,
      y: 0,
      width: 2560,
      height: 1440,
    });

    internals.fitCaptureSourceToCanvas({ width: 1920, height: 1080 });

    expect(noobs.SetSourcePos).toHaveBeenCalledWith(
      "source-1",
      expect.objectContaining({ scaleX: 0.75, scaleY: 0.75 }),
    );

    noobs.SetSourcePos.mockClear();
    internals.captureSourceResolution = { width: 1280, height: 720 };
    internals.readCaptureSourceResolution = vi.fn(() => null);
    internals.fitCaptureSourceToCanvas({ width: 1920, height: 1080 });
    expect(noobs.SetSourcePos).toHaveBeenCalledWith(
      "source-1",
      expect.objectContaining({ scaleX: 1.5, scaleY: 1.5 }),
    );

    noobs.SetSourcePos.mockClear();
    internals.captureSourceResolution = null;
    internals.resolveCaptureTarget = vi.fn(() => ({
      kind: "window",
      id: "window:missing:0",
      label: "Missing window",
    }));
    internals.fitCaptureSourceToCanvas({ width: 1920, height: 1080 });
    expect(noobs.SetSourcePos).toHaveBeenCalledWith(
      "source-1",
      expect.objectContaining({ scaleX: 1, scaleY: 1 }),
    );
  });

  it("configures packaged OBS process environment", () => {
    const runtimePath = join(directory, "runtime");
    const binPath = join(runtimePath, "bin");
    mkdirSync(binPath, { recursive: true });
    writeFileSync(join(binPath, "obs-ffmpeg-mux.exe"), "mux");
    const service = createService();
    const internals = service as unknown as {
      configureNoobsProcessEnvironment(runtimePath: string): void;
    };
    const previousPath = process.env.Path;
    const previousUpperPath = process.env.PATH;
    const previousMux = process.env.FFMPEG_MUX;

    try {
      process.env.Path = "C:\\Windows";
      process.env.PATH = "C:\\Windows";
      internals.configureNoobsProcessEnvironment(runtimePath);

      expect(process.env.Path?.toLowerCase()).toContain(binPath.toLowerCase());
      expect(process.env.PATH?.toLowerCase()).toContain(binPath.toLowerCase());
      expect(process.env.FFMPEG_MUX).toBe(join(binPath, "obs-ffmpeg-mux.exe"));
    } finally {
      process.env.Path = previousPath;
      process.env.PATH = previousUpperPath;
      if (previousMux === undefined) {
        delete process.env.FFMPEG_MUX;
      } else {
        process.env.FFMPEG_MUX = previousMux;
      }
    }
  });

  it("ignores noobs runtime environment overrides in packaged builds", () => {
    const runtimePath = join(directory, "env-runtime");
    mkdirSync(runtimePath, { recursive: true });
    process.env.HINEKORA_NOOBS_PATH = runtimePath;
    electronMocks.isPackaged = true;
    const service = new ManagedRecorderService() as unknown as {
      resolveNoobsRuntimePath(): string | null;
    };

    expect(service.resolveNoobsRuntimePath()).not.toBe(resolve(runtimePath));
  });

  it("resolves replay output directories and packaged noobs resources", () => {
    const resourcesPath = join(directory, "resources");
    const resourcesRuntimePath = join(
      resourcesPath,
      "node_modules",
      "noobs",
      "dist",
    );
    const unpackedRuntimePath = join(
      resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "noobs",
      "dist",
    );
    mkdirSync(resourcesRuntimePath, { recursive: true });
    mkdirSync(unpackedRuntimePath, { recursive: true });
    const originalResourcesPath = process.resourcesPath;
    const service = createService() as unknown as {
      resolveNoobsRuntimePath(): string | null;
      resolveOutputDirectoryForReplayKind(kind: "death" | "manual"): string;
    };

    try {
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: resourcesPath,
      });

      expect(service.resolveOutputDirectoryForReplayKind("death")).toBe(
        join(directory, "Death Clips"),
      );
      expect(service.resolveOutputDirectoryForReplayKind("manual")).toBe(
        join(directory, "Manual Replays"),
      );
      electronMocks.isPackaged = true;
      expect(service.resolveNoobsRuntimePath()).toBe(unpackedRuntimePath);
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: undefined,
      });
      electronMocks.isPackaged = false;
      expect(service.resolveNoobsRuntimePath()).toContain(
        join("node_modules", "noobs", "dist"),
      );
    } finally {
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: originalResourcesPath,
      });
    }
  });

  it("returns null when no OBS runtime candidate exists", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync: () => false,
      };
    });

    try {
      const { ManagedRecorderService: MockedManagedRecorderService } =
        await import("../ManagedRecorder.service");
      const service = Object.create(MockedManagedRecorderService.prototype) as {
        resolveNoobsRuntimePath(): string | null;
      };

      expect(service.resolveNoobsRuntimePath()).toBeNull();
    } finally {
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });

  it("classifies noobs runtime paths", () => {
    expect(isAsarVirtualPath("C:\\app\\resources\\app.asar\\dist")).toBe(true);
    expect(
      isAsarVirtualPath("C:\\app\\resources\\app.asar.unpacked\\dist"),
    ).toBe(false);
    expect(
      describeNoobsRuntimeLocation(
        "C:\\app\\resources\\app.asar.unpacked\\node_modules\\noobs\\dist",
      ),
    ).toBe("asar-unpacked");
    expect(
      describeNoobsRuntimeLocation(
        "C:\\app\\resources\\app.asar\\node_modules\\noobs\\dist",
      ),
    ).toBe("asar-virtual");
    expect(
      describeNoobsRuntimeLocation("C:\\repo\\node_modules\\noobs\\dist"),
    ).toBe("node-modules");
    expect(describeNoobsRuntimeLocation("C:\\runtime")).toBe("custom");
  });

  it("initializes the packaged runtime through existing seams", async () => {
    const runtimePath = join(directory, "runtime");
    mkdirSync(join(runtimePath, "bin"), { recursive: true });

    const missingRuntime = createService() as unknown as {
      initialize(): Promise<void>;
      resolveNoobsRuntimePath(): string | null;
    };
    missingRuntime.resolveNoobsRuntimePath = vi.fn(() => null);
    await expect(missingRuntime.initialize()).rejects.toThrow(
      "Packaged OBS runtime is missing",
    );

    noobsMocks.loadNoobsApi.mockResolvedValueOnce(null);
    const missingNoobs = new ManagedRecorderService() as unknown as {
      configureNoobsProcessEnvironment(runtimePath: string): void;
      configureCaptureSource(): void;
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi> | null;
      resolveNoobsRuntimePath(): string | null;
      status: ManagedRecorderStatus;
    };
    missingNoobs.resolveNoobsRuntimePath = vi.fn(() => runtimePath);
    missingNoobs.configureNoobsProcessEnvironment = vi.fn();
    missingNoobs.configureCaptureSource = vi.fn();
    missingNoobs.noobs = null;
    missingNoobs.status = {
      ...createService().getStatus(),
      initialized: true,
    };
    await expect(missingNoobs.initialize()).rejects.toThrow(
      "noobs module is not installed",
    );

    const noobs = createNoobsApi();
    noobsMocks.loadNoobsApi.mockResolvedValueOnce(noobs);
    const initialized = new ManagedRecorderService() as unknown as {
      configureNoobsProcessEnvironment(runtimePath: string): void;
      configureCaptureSource(): void;
      getStatus(): ManagedRecorderStatus;
      initialize(): Promise<void>;
      noobs: ReturnType<typeof createNoobsApi> | null;
      resolveNoobsRuntimePath(): string | null;
      status: ManagedRecorderStatus;
    };
    initialized.resolveNoobsRuntimePath = vi.fn(() => runtimePath);
    initialized.configureNoobsProcessEnvironment = vi.fn();
    initialized.configureCaptureSource = vi.fn();
    initialized.noobs = null;
    initialized.status = {
      ...createService().getStatus(),
      initialized: true,
    };

    await initialized.initialize();

    expect(noobsMocks.loadNoobsApi).toHaveBeenCalledWith(
      noobsMocks.importNoobsModule,
    );
    expect(initialized.configureNoobsProcessEnvironment).toHaveBeenCalledWith(
      runtimePath,
    );
    expect(initialized.configureCaptureSource).toHaveBeenCalled();
    expect(initialized.getStatus()).toMatchObject({
      available: true,
      initialized: true,
      runtimePath,
      outputDirectory: directory,
      error: null,
    });
  });

  it("initializes noobs runtime, logging, and buffering on first initialization", async () => {
    const runtimePath = join(directory, "runtime");
    const previousPath = process.env.Path;
    const previousUpperPath = process.env.PATH;
    const previousMux = process.env.FFMPEG_MUX;
    mkdirSync(runtimePath, { recursive: true });
    process.env.HINEKORA_NOOBS_PATH = runtimePath;
    const noobs = createNoobsApi();
    noobsMocks.loadNoobsApi.mockResolvedValue(noobs);
    const service = createService();
    const internals = service as unknown as {
      initialize(): Promise<void>;
    };

    try {
      await internals.initialize();

      expect(noobs.Init).toHaveBeenCalledWith(
        runtimePath,
        join(directory, "managed-recorder-logs"),
        expect.any(Function),
      );
      expect(noobs.SetBuffering).toHaveBeenCalledWith(true);
      expect(noobs.CreateSource).toHaveBeenCalled();
      expect(service.getStatus()).toMatchObject({
        available: true,
        initialized: true,
        runtimePath,
        outputDirectory: directory,
        error: null,
      });

      noobs.Init.mockClear();
      await internals.initialize();
      expect(noobs.Init).not.toHaveBeenCalled();
    } finally {
      process.env.Path = previousPath;
      process.env.PATH = previousUpperPath;
      if (previousMux === undefined) {
        delete process.env.FFMPEG_MUX;
      } else {
        process.env.FFMPEG_MUX = previousMux;
      }
    }
  });

  it("keeps noobs runtime initialization defensive and restores cwd", () => {
    const service = createService();
    const noobs = createNoobsApi();
    const runtimePath = join(directory, "runtime");
    const logPath = join(directory, "logs");
    const previousCwd = process.cwd();
    const internals = service as unknown as {
      handleSignal(signal: unknown): void;
      initializeNoobsRuntime(runtimePath: string, logPath: string): void;
      noobs: ReturnType<typeof createNoobsApi> | null;
    };
    const handleSignal = vi
      .spyOn(internals, "handleSignal")
      .mockImplementation(() => undefined);

    internals.noobs = null;
    expect(() =>
      internals.initializeNoobsRuntime(runtimePath, logPath),
    ).toThrow("noobs module is not installed");

    internals.noobs = noobs;
    internals.initializeNoobsRuntime(runtimePath, logPath);

    expect(noobs.Init).toHaveBeenCalledWith(
      runtimePath,
      logPath,
      expect.any(Function),
    );
    const signalHandler = noobs.Init.mock.calls[0]?.[2] as
      | ((signal: unknown) => void)
      | undefined;
    signalHandler?.({ type: "output", id: "start", code: 0 });
    expect(handleSignal).toHaveBeenCalledWith({
      type: "output",
      id: "start",
      code: 0,
    });
    expect(process.cwd()).toBe(previousCwd);
  });

  it("resolves recording-stop waits from timeout or signal callbacks", async () => {
    vi.useFakeTimers();
    const service = createService();
    const internals = service as unknown as {
      recordingStopWaiter: (() => void) | null;
      waitForRecordingStop(): Promise<void>;
    };

    const signaled = internals.waitForRecordingStop();
    internals.recordingStopWaiter?.();
    await expect(signaled).resolves.toBeUndefined();

    const timedOut = internals.waitForRecordingStop();
    vi.advanceTimersByTime(5_000);
    await expect(timedOut).resolves.toBeUndefined();

    const doubleSignal = createService();
    const doubleInternals = doubleSignal as unknown as {
      recordingStopWaiter: (() => void) | null;
      waitForRecordingStop(): Promise<void>;
    };
    const doublePromise = doubleInternals.waitForRecordingStop();
    const waiter = doubleInternals.recordingStopWaiter;
    waiter?.();
    waiter?.();
    await expect(doublePromise).resolves.toBeUndefined();
  });

  it("waits for replay conversion and file polling timers", async () => {
    vi.useFakeTimers();
    const service = createService();
    const internals = service as unknown as {
      waitForRecordingFilePoll(): Promise<void>;
      waitForReplayConversionStopDelay(): Promise<void>;
    };

    const conversionDelay = internals.waitForReplayConversionStopDelay();
    await vi.runOnlyPendingTimersAsync();
    await expect(conversionDelay).resolves.toBeUndefined();

    const filePoll = internals.waitForRecordingFilePoll();
    await vi.runOnlyPendingTimersAsync();
    await expect(filePoll).resolves.toBeUndefined();
  });

  it("waits for stable files and times out when files never appear", async () => {
    const service = createService();
    const internals = service as unknown as {
      readRecordingFileSnapshot(path: string): {
        size: number;
        mtimeMs: number;
      } | null;
      resolveSavedRecordingPath(
        outputDirectory: string,
        modifiedAfterMs: number,
        ignoredPaths?: Set<string>,
      ): string | null;
      waitForRecordingFileDetection(
        outputDirectory: string,
        modifiedAfterMs: number,
        waitMs: number,
      ): Promise<string | null>;
      waitForRecordingFilePoll(): Promise<void>;
      waitForSavedRecording(
        outputDirectory: string,
        modifiedAfterMs: number,
        waitMs?: number,
      ): Promise<string | null>;
      waitForStableRecordingFile(
        path: string,
        deadlineMs: number,
      ): Promise<boolean>;
    };
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    internals.waitForRecordingFilePoll = vi.fn(async () => {
      now += 500;
    });
    const stableSnapshot = { size: 100, mtimeMs: 1_000 };
    const snapshots = [
      null,
      stableSnapshot,
      stableSnapshot,
      stableSnapshot,
      stableSnapshot,
    ];
    internals.readRecordingFileSnapshot = vi.fn(
      () => snapshots.shift() ?? stableSnapshot,
    );

    await expect(
      internals.waitForStableRecordingFile("clip.mp4", 3_000),
    ).resolves.toBe(true);

    now = 0;
    internals.resolveSavedRecordingPath = vi.fn(() => null);
    await expect(
      internals.waitForRecordingFileDetection(directory, 0, 1_000),
    ).resolves.toBeNull();

    now = 0;
    await expect(
      internals.waitForSavedRecording(directory, 0, 1_000),
    ).resolves.toBeNull();
  });

  it("stops replay conversion recordings only when noobs is active", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi> | null;
      stopReplayConversionRecording(path: string): Promise<void>;
      waitForRecordingStop(): Promise<void>;
    };

    internals.noobs = null;
    await expect(
      internals.stopReplayConversionRecording("missing.mp4"),
    ).resolves.toBeUndefined();

    internals.noobs = noobs;
    internals.waitForRecordingStop = vi.fn().mockResolvedValue(undefined);
    await internals.stopReplayConversionRecording("clip.mp4");
    expect(noobs.StopRecording).toHaveBeenCalled();
  });

  it("returns early for inactive stops and reports start/stop failures", async () => {
    const service = createService();
    await expect(service.stopBuffer()).resolves.toMatchObject({
      bufferActive: false,
    });

    const startFailure = createService();
    const startInternals = startFailure as unknown as {
      initialize(): Promise<void>;
      noobs: null;
    };
    startInternals.initialize = vi.fn().mockResolvedValue(undefined);
    startInternals.noobs = null;
    await expect(startFailure.startRunRecording()).resolves.toMatchObject({
      recording: false,
      runRecordingActive: false,
      error: "noobs module is not installed",
    });

    const stopFailure = createService();
    const noobs = createNoobsApi();
    const stopInternals = stopFailure as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      status: ManagedRecorderStatus;
      waitForRecordingStop(): Promise<void>;
    };
    stopInternals.noobs = noobs;
    stopInternals.status = {
      ...stopFailure.getStatus(),
      activeSessionDirectory: directory,
      initialized: true,
      recording: true,
      runRecordingActive: true,
      runRecordingStartedAt: new Date().toISOString(),
    };
    stopInternals.waitForRecordingStop = vi
      .fn()
      .mockRejectedValue(new Error("stop failed"));

    await expect(stopFailure.stopRunRecording()).resolves.toMatchObject({
      isStoppingRecording: false,
      error: "stop failed",
    });
  });

  it("rejects buffered replay saves when no managed session is active", async () => {
    const service = createService();
    const internals = service as unknown as {
      saveBufferedReplay(
        seconds: number,
        options: { kind: "death" | "manual"; restartBufferAfterSave: boolean },
      ): Promise<string>;
    };

    await expect(
      internals.saveBufferedReplay(10, {
        kind: "death",
        restartBufferAfterSave: false,
      }),
    ).rejects.toThrow("Managed recorder session is not active");
  });

  it("falls back when optional recorder helpers fail or are unavailable", () => {
    const service = createService();
    const internals = service as unknown as {
      listAvailableVideoEncoders(): string[];
      noobs: {
        GetSourceProperties?: (sourceName: string) => unknown;
        ListVideoEncoders?: () => string[];
      };
      readSourceProperties(sourceName: string): unknown[];
      resolveReplaySaveWaitMs(requestedSeconds: number): number;
      status: ManagedRecorderStatus;
    };
    internals.noobs = {
      GetSourceProperties: () => {
        throw new Error("properties unavailable");
      },
      ListVideoEncoders: () => {
        throw new Error("encoders unavailable");
      },
    };

    expect(internals.listAvailableVideoEncoders()).toEqual([]);
    expect(internals.readSourceProperties("source-1")).toEqual([]);

    internals.noobs = {};
    expect(internals.listAvailableVideoEncoders()).toEqual([]);
    expect(internals.readSourceProperties("source-1")).toEqual([]);

    internals.status = {
      ...service.getStatus(),
      outputResolution: "1920x1080",
    };
    expect(internals.resolveReplaySaveWaitMs(15)).toBeGreaterThan(0);
  });

  it("configures noobs process environment from PATH fallbacks", () => {
    const service = createService();
    const runtimePath = join(directory, "runtime");
    const runtimeBinPath = join(runtimePath, "bin");
    const muxPath = join(runtimeBinPath, "obs-ffmpeg-mux.exe");
    const previousPath = process.env.Path;
    const previousUpperPath = process.env.PATH;
    const previousMux = process.env.FFMPEG_MUX;
    const internals = service as unknown as {
      configureNoobsProcessEnvironment(runtimePath: string): void;
    };

    try {
      mkdirSync(runtimeBinPath, { recursive: true });
      writeFileSync(muxPath, "");

      delete process.env.Path;
      process.env.PATH = `C:/Windows/System32`;
      internals.configureNoobsProcessEnvironment(runtimePath);
      const updatedPath = String(
        (process.env as Record<string, string | undefined>).Path ?? "",
      );
      expect(updatedPath.split(";")).toContain(runtimeBinPath);

      delete process.env.Path;
      delete process.env.PATH;
      internals.configureNoobsProcessEnvironment(runtimePath);
      expect(process.env.Path).toBe(runtimeBinPath);
      expect(process.env.FFMPEG_MUX).toBe(muxPath);
    } finally {
      if (previousPath === undefined) {
        delete process.env.Path;
      } else {
        process.env.Path = previousPath;
      }
      if (previousUpperPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousUpperPath;
      }
      if (previousMux === undefined) {
        delete process.env.FFMPEG_MUX;
      } else {
        process.env.FFMPEG_MUX = previousMux;
      }
    }
  });

  it("registers IPC handlers for recorder controls", async () => {
    const { handlers } = mockIpcMainHandlers();
    const service = new ManagedRecorderService();
    const status = { ...service.getStatus(), initialized: true };
    const startBuffer = vi
      .spyOn(service, "startBuffer")
      .mockResolvedValue(status);
    const setCaptureMode = vi.spyOn(service, "setCaptureMode");
    const stopBuffer = vi
      .spyOn(service, "stopBuffer")
      .mockResolvedValue(status);
    const startRunRecording = vi
      .spyOn(service, "startRunRecording")
      .mockResolvedValue(status);
    const stopRunRecording = vi
      .spyOn(service, "stopRunRecording")
      .mockResolvedValue(status);
    const saveReplay = vi.spyOn(service, "saveReplay").mockResolvedValue({
      ok: true,
      path: "clip.mp4",
      error: null,
    });
    const listAudioDevices = vi
      .spyOn(service, "listAudioDevices")
      .mockResolvedValue({
        input: [],
        output: [],
      });

    expect(
      await handlers.get(ManagedRecorderChannel.GetStatus)?.({}),
    ).toMatchObject({
      outputDirectory: directory,
    });
    expect(
      await handlers.get(ManagedRecorderChannel.GetCaptureMode)?.({}),
    ).toBe("rewind");
    await expect(
      handlers.get(ManagedRecorderChannel.ListAudioDevices)?.({}),
    ).resolves.toEqual({
      input: [],
      output: [],
    });
    await expect(
      handlers.get(ManagedRecorderChannel.ListAudioDevices)?.({}, true),
    ).resolves.toEqual({
      input: [],
      output: [],
    });
    expect(
      handlers.get(ManagedRecorderChannel.ListAudioDevices)?.({}, "bad"),
    ).toEqual({
      ok: false,
      error: "forceRefresh must be a boolean",
    });
    expect(
      await handlers.get(ManagedRecorderChannel.SetCaptureMode)?.(
        {},
        "session",
      ),
    ).toBe("session");
    await handlers.get(ManagedRecorderChannel.StartBuffer)?.({});
    await handlers.get(ManagedRecorderChannel.StopBuffer)?.({});
    await handlers.get(ManagedRecorderChannel.StartRunRecording)?.({});
    await handlers.get(ManagedRecorderChannel.StopRunRecording)?.({});
    await handlers.get(ManagedRecorderChannel.SaveReplay)?.({});

    expect(setCaptureMode).toHaveBeenCalledWith("session");
    expect(startBuffer).toHaveBeenCalled();
    expect(stopBuffer).toHaveBeenCalled();
    expect(startRunRecording).toHaveBeenCalled();
    expect(stopRunRecording).toHaveBeenCalled();
    expect(saveReplay).toHaveBeenCalledWith(10, "manual");
    expect(listAudioDevices).toHaveBeenNthCalledWith(1, {});
    expect(listAudioDevices).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
    });
    expect(
      await handlers.get(ManagedRecorderChannel.SetCaptureMode)?.({}, "bad"),
    ).toEqual({
      ok: false,
      error: "captureMode must be session or rewind",
    });
  });

  it("resolves recorder geometry and file helper edge cases", () => {
    const service = createService();
    const emptyFile = join(directory, "empty.mp4");
    writeFileSync(emptyFile, "");
    const internals = service as unknown as {
      readCaptureSourceResolution(sourceName: string): unknown;
      readRecordingFileSnapshot(path: string): unknown;
      noobs: {
        GetSourcePos(sourceName: string): unknown;
      };
    };

    expect(internals.readRecordingFileSnapshot(emptyFile)).toBeNull();

    internals.noobs = { GetSourcePos: () => ({ width: 640.4, height: 360.2 }) };
    expect(internals.readCaptureSourceResolution("source-1")).toEqual({
      width: 640,
      height: 360,
    });
    internals.noobs = { GetSourcePos: () => ({ width: 0, height: 360 }) };
    expect(internals.readCaptureSourceResolution("source-1")).toBeNull();
  });

  it("covers capture source and canvas fitting fallbacks", () => {
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      captureSourceName: string | null;
      captureSourceResolution: { width: number; height: number } | null;
      configureCaptureSource(): void;
      createWindowSourceSettings(
        sourceName: string,
        settings: Record<string, unknown>,
        target: {
          kind: "window";
          id: string;
          label: string;
        },
      ): Record<string, unknown>;
      fitCaptureSourceToCanvas(canvas: { width: number; height: number }): void;
      noobs: ReturnType<typeof createNoobsApi>;
      readCaptureSourceResolution(sourceName: string): unknown;
      resolveCaptureTarget(): {
        kind: "display";
        id: string;
        label: string;
      };
      status: ManagedRecorderStatus;
    };
    internals.noobs = noobs;
    noobs.GetSourceProperties.mockReturnValue([
      {
        name: "window",
        items: [{ name: "Path of Exile", value: "window:poe:live" }],
      },
    ]);
    noobs.GetSourcePos.mockReturnValue({ x: 0, y: 0, width: 0, height: 0 });
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "Window", game: "poe1" }),
          captureTarget: {
            kind: "window",
            id: "window:poe:1",
            label: "Path of Exile",
          },
        },
      ],
    } as unknown as CaptureProfilesService);

    internals.configureCaptureSource();
    expect(noobs.CreateSource).toHaveBeenCalledWith(
      "Hinekora Capture",
      "window_capture",
    );
    expect(internals.captureSourceResolution).toBeNull();

    expect(
      internals.createWindowSourceSettings(
        "source-1",
        { method: 7 },
        { kind: "window", id: "window:poe:1", label: "Path of Exile" },
      ),
    ).toMatchObject({ method: 7, window: "window:poe:live" });
    expect(
      internals.createWindowSourceSettings(
        "source-1",
        {},
        { kind: "window", id: "window:poe:1", label: "Path of Exile" },
      ),
    ).toMatchObject({ method: 0, window: "window:poe:live" });

    noobs.GetSourceProperties.mockReturnValueOnce([
      { name: "window", items: [] },
    ]);
    expect(() =>
      internals.createWindowSourceSettings(
        "source-1",
        {},
        { kind: "window", id: "window:poe:1", label: "Path of Exile" },
      ),
    ).toThrow("Selected capture window is not available yet");

    internals.captureSourceName = "source-1";
    internals.captureSourceResolution = { width: 1280, height: 720 };
    internals.readCaptureSourceResolution = vi.fn(() => null);
    internals.fitCaptureSourceToCanvas({ width: 1920, height: 1080 });
    expect(noobs.SetSourcePos).toHaveBeenLastCalledWith(
      "source-1",
      expect.objectContaining({ scaleX: 1.5, scaleY: 1.5 }),
    );

    internals.captureSourceResolution = null;
    internals.resolveCaptureTarget = vi.fn(() => ({
      kind: "display" as const,
      id: "primary",
      label: "Primary",
    }));
    internals.fitCaptureSourceToCanvas({ width: 1920, height: 1080 });
    expect(noobs.SetSourcePos).toHaveBeenLastCalledWith(
      "source-1",
      expect.objectContaining({ scaleX: 1, scaleY: 1 }),
    );
  });

  it("resolves capture target from the persisted selected profile when it matches the active game", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        selectedCaptureProfileId: "profile-2",
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "PoE 1", game: "poe1" }),
          id: "profile-1",
          captureTarget: {
            kind: "display",
            id: "display-1",
            label: "Display 1",
          },
        },
        {
          ...createDefaultCaptureProfile({ name: "PoE 2", game: "poe2" }),
          id: "profile-2",
          captureTarget: {
            kind: "window",
            id: "window:poe2:1",
            label: "Path of Exile 2",
            game: "poe2",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    const service = createService();
    const internals = service as unknown as {
      resolveCaptureTarget(): unknown;
    };

    expect(internals.resolveCaptureTarget()).toEqual({
      kind: "window",
      id: "window:poe2:1",
      label: "Path of Exile 2",
      game: "poe2",
    });
  });

  it("uses the persisted selected profile even when active game is stale", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        selectedCaptureProfileId: "profile-2",
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "PoE 1", game: "poe1" }),
          id: "profile-1",
          captureTarget: {
            kind: "display",
            id: "display-1",
            label: "Display 1",
          },
        },
        {
          ...createDefaultCaptureProfile({ name: "PoE 2", game: "poe2" }),
          id: "profile-2",
          captureTarget: {
            kind: "window",
            id: "window:poe2:1",
            label: "Path of Exile 2",
            game: "poe2",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    const service = createService();
    const internals = service as unknown as {
      resolveCaptureTarget(): unknown;
    };

    expect(internals.resolveCaptureTarget()).toEqual({
      kind: "window",
      id: "window:poe2:1",
      label: "Path of Exile 2",
      game: "poe2",
    });
  });

  it("uses the primary display when the active game has no selected or matching profile", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe2",
        selectedCaptureProfileId: null,
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "PoE 1", game: "poe1" }),
          id: "profile-1",
          captureTarget: {
            kind: "window",
            id: "window:poe1:1",
            label: "Path of Exile",
            game: "poe1",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    const service = createService();
    const internals = service as unknown as {
      resolveCaptureTarget(): unknown;
    };

    expect(internals.resolveCaptureTarget()).toEqual({
      kind: "display",
      id: "primary",
      label: "Primary display",
    });
  });

  it("ignores active-game profile window targets that point at another game", () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        selectedCaptureProfileId: "profile-1",
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "PoE 1", game: "poe1" }),
          id: "profile-1",
          captureTarget: {
            kind: "window",
            id: "window:poe2:1",
            label: "Path of Exile 2",
            game: "poe2",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    const service = createService();
    const internals = service as unknown as {
      resolveCaptureTarget(): unknown;
    };

    expect(internals.resolveCaptureTarget()).toEqual({
      kind: "display",
      id: "primary",
      label: "Primary display",
    });
  });

  it("does not start recording when the selected window is unavailable", async () => {
    vi.spyOn(SettingsStoreService, "getInstance").mockReturnValue({
      get: () => ({
        ...createDefaultSettings(),
        activeGame: "poe1",
        recordingStoragePath: directory,
        selectedCaptureProfileId: "profile-1",
      }),
    } as unknown as SettingsStoreService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "PoE 1", game: "poe1" }),
          id: "profile-1",
          captureTarget: {
            kind: "window",
            id: "window:poe:missing",
            label: "Path of Exile",
            game: "poe1",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    const service = createService();
    const noobs = createNoobsApi();
    const internals = service as unknown as {
      ensureNoobsRuntimeInitialized(): Promise<string>;
      noobs: ReturnType<typeof createNoobsApi>;
    };
    internals.noobs = noobs;
    internals.ensureNoobsRuntimeInitialized = vi
      .fn()
      .mockResolvedValue(join(directory, "runtime"));
    noobs.GetSourceProperties.mockReturnValue([{ name: "window", items: [] }]);

    await expect(service.startBuffer()).resolves.toMatchObject({
      error: "Selected capture window is not available yet",
      recording: false,
    });
    expect(noobs.SetSourceSettings).not.toHaveBeenCalled();
    expect(noobs.StartBuffer).not.toHaveBeenCalled();
    expect(noobs.DeleteSource).toHaveBeenCalledWith("source-1");
  });

  it("returns null when recording file metadata cannot be read", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();

      return {
        ...actual,
        existsSync: () => true,
        statSync: () => {
          throw new Error("stat failed");
        },
      };
    });

    try {
      const { ManagedRecorderService: MockedManagedRecorderService } =
        await import("../ManagedRecorder.service");
      const internals = Object.create(
        MockedManagedRecorderService.prototype,
      ) as {
        readRecordingFileSnapshot(path: string): unknown;
      };

      expect(internals.readRecordingFileSnapshot("clip.mp4")).toBeNull();
    } finally {
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });

  it("waits through missing recording snapshots and times out cleanly", async () => {
    const service = createService();
    const missingPath = join(directory, "missing.mp4");
    const internals = service as unknown as {
      waitForRecordingFilePoll(): Promise<void>;
      waitForStableRecordingFile(
        path: string,
        deadlineMs: number,
      ): Promise<boolean>;
    };
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(3_000);
    internals.waitForRecordingFilePoll = vi.fn().mockResolvedValue(undefined);

    await expect(
      internals.waitForStableRecordingFile(missingPath, 2_000),
    ).resolves.toBe(false);
    expect(internals.waitForRecordingFilePoll).toHaveBeenCalled();
  });

  it("resolves native recording size through Electron displays", () => {
    const service = createService();
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "Display", game: "poe1" }),
          captureTarget: {
            kind: "display",
            id: "1",
            label: "Primary display",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    electronMocks.getAllDisplays.mockReturnValue([
      {
        id: 1,
        scaleFactor: 1,
        size: { width: 1920, height: 1080 },
      },
    ]);
    const internals = service as unknown as {
      captureSourceResolution: { width: number; height: number } | null;
      resolveRecordingResolution(value: string): unknown;
    };

    expect(internals.resolveRecordingResolution("1280x720")).toEqual({
      width: 1280,
      height: 720,
    });
    expect(internals.resolveRecordingResolution("native")).toEqual({
      width: 1920,
      height: 1080,
    });

    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "Primary", game: "poe1" }),
          captureTarget: {
            kind: "display",
            id: "primary",
            label: "Primary display",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    electronMocks.getAllDisplays.mockReturnValue([]);

    expect(internals.resolveRecordingResolution("native")).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(electronMocks.getPrimaryDisplay).toHaveBeenCalled();

    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [
        {
          ...createDefaultCaptureProfile({ name: "Window", game: "poe1" }),
          captureTarget: {
            kind: "window",
            id: "window:missing:0",
            label: "Missing window",
          },
        },
      ],
    } as unknown as CaptureProfilesService);
    electronMocks.getAllDisplays.mockReturnValue([]);
    internals.captureSourceResolution = { width: 1024, height: 768 };
    expect(internals.resolveRecordingResolution("native")).toEqual({
      width: 1024,
      height: 768,
    });

    internals.captureSourceResolution = null;
    expect(internals.resolveRecordingResolution("native")).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("resolves saved recording paths from noobs or the output directory", () => {
    const service = createService();
    const newestPath = join(directory, "2026-06-12_10-30-00.mp4");
    const noobsPath = join(directory, "2026-06-12_10-31-00.mp4");
    writeFileSync(newestPath, "older");
    writeFileSync(noobsPath, "newer");
    utimesSync(newestPath, new Date(1_000), new Date(1_000));
    utimesSync(noobsPath, new Date(2_000), new Date(2_000));
    const internals = service as unknown as {
      noobs: { GetLastRecording(): string | null };
      resolveSavedRecordingPath(
        outputDirectory: string,
        modifiedAfterMs: number,
        ignoredPaths?: Set<string>,
      ): string | null;
    };

    internals.noobs = { GetLastRecording: () => noobsPath };
    expect(internals.resolveSavedRecordingPath(directory, 0)).toBe(
      resolve(noobsPath),
    );

    internals.noobs = { GetLastRecording: () => null };
    expect(internals.resolveSavedRecordingPath(directory, 0)).toBe(
      resolve(noobsPath),
    );
  });

  it("handles recorder output signals and publishes status changes", () => {
    const service = createService();
    const internals = service as unknown as {
      activeRecordingMode: "buffer" | "run" | null;
      handleSignal(signal: unknown): void;
      recordingStopWaiter: (() => void) | null;
    };
    const stopped = vi.fn();

    internals.activeRecordingMode = "run";
    internals.handleSignal({ type: "output", id: "start", code: 0 });
    expect(service.getStatus()).toMatchObject({
      recording: true,
      runRecordingActive: true,
      bufferActive: false,
    });

    internals.recordingStopWaiter = stopped;
    internals.handleSignal({ type: "output", id: "deactivate", code: 0 });
    expect(stopped).toHaveBeenCalled();
    expect(service.getStatus()).toMatchObject({
      recording: false,
      runRecordingActive: false,
      bufferActive: false,
      error: null,
    });
    expect(send).toHaveBeenCalledWith(
      ManagedRecorderChannel.StatusChanged,
      expect.objectContaining({ runtime: "packaged_obs" }),
    );

    internals.activeRecordingMode = "buffer";
    internals.handleSignal({ type: "output", id: "start", code: 0 });
    expect(service.getStatus()).toMatchObject({
      recording: true,
      runRecordingActive: false,
      bufferActive: true,
    });

    internals.handleSignal({ type: "output", id: "warning", code: 2 });
    internals.handleSignal({ type: "output", id: "missing-code" });
    internals.handleSignal({ type: "other", id: "ignored", code: 0 });
  });

  it("publishes capture mode changes only to live windows", () => {
    const service = createService();
    const liveSend = vi.fn();
    const destroyedSend = vi.fn();
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send: destroyedSend } },
      { isDestroyed: () => false, webContents: { send: liveSend } },
    ]);

    expect(service.setCaptureMode("session")).toBe("session");

    expect(liveSend).toHaveBeenCalledWith(
      ManagedRecorderChannel.CaptureModeChanged,
      "session",
    );
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it("falls back to maximum duration for invalid recording timestamps", () => {
    const service = createService();
    const internals = service as unknown as {
      getActiveRecordingDurationSeconds(): number;
      status: ReturnType<ManagedRecorderService["getStatus"]>;
    };
    internals.status = {
      ...service.getStatus(),
      recordingStartedAt: "not-a-date",
    };

    expect(internals.getActiveRecordingDurationSeconds()).toBe(90);
  });

  it("handles defensive recorder fallbacks without changing active recording state", async () => {
    const service = createService();
    const cleanup = vi.fn(() => {
      throw new Error("cleanup failed");
    });
    vi.spyOn(RecordingStorageService, "getInstance").mockReturnValue({
      cleanup,
    } as unknown as RecordingStorageService);
    vi.spyOn(CaptureProfilesService, "getInstance").mockReturnValue({
      list: () => [],
    } as unknown as CaptureProfilesService);
    const internals = service as unknown as {
      cleanupRecordingStorage(protectedPaths: Array<string | null>): void;
      getActiveRecordingDurationSeconds(): number;
      noobs: unknown;
      readCaptureSourceResolution(sourceName: string): unknown;
      resolveCaptureTarget(): unknown;
      resolveSavedRecordingPath(
        outputDirectory: string,
        modifiedAfterMs: number,
        ignoredPaths?: Set<string>,
      ): string | null;
      restartReplayBufferAfterSave(
        sessionDirectory: string,
        recordingStartedAt: string | null,
        activeGame: GameId | null,
      ): void;
      status: ManagedRecorderStatus;
      waitForRecordingStop(): Promise<void>;
      recordingStopWaiter: (() => void) | null;
    };

    expect(internals.resolveCaptureTarget()).toEqual({
      kind: "display",
      id: "primary",
      label: "Primary display",
    });

    internals.noobs = {
      GetSourcePos: () => {
        throw new Error("position unavailable");
      },
      GetLastRecording: () => {
        throw new Error("last recording unavailable");
      },
    };
    expect(internals.readCaptureSourceResolution("source-1")).toBeNull();
    expect(internals.resolveSavedRecordingPath(directory, 0)).toBeNull();

    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: directory,
      bufferActive: true,
      recording: true,
      recordingStartedAt: null,
    };
    internals.noobs = null;
    internals.restartReplayBufferAfterSave(directory, null, null);
    expect(service.getStatus()).toMatchObject({
      bufferActive: true,
      recording: true,
    });
    expect(internals.getActiveRecordingDurationSeconds()).toBe(90);

    internals.cleanupRecordingStorage([null, join(directory, "clip.mp4")]);
    expect(cleanup).toHaveBeenCalledWith({
      protectedDirectories: [directory],
      protectedPaths: [join(directory, "clip.mp4")],
    });

    const stopped = internals.waitForRecordingStop();
    const waiter = internals.recordingStopWaiter;
    waiter?.();
    waiter?.();
    await expect(stopped).resolves.toBeUndefined();
  });

  it("stops full run recordings while preserving previous paths when no file is saved", async () => {
    const service = createService();
    const noobs = createNoobsApi();
    const previousPath = join(directory, "previous.mp4");
    const internals = service as unknown as {
      noobs: ReturnType<typeof createNoobsApi>;
      status: ManagedRecorderStatus;
      waitForRecordingStop(): Promise<void>;
    };
    noobs.GetLastRecording.mockReturnValue(null);
    internals.noobs = noobs;
    internals.status = {
      ...service.getStatus(),
      activeSessionDirectory: null,
      initialized: true,
      lastRecordingPath: previousPath,
      recording: true,
      runRecordingActive: true,
      runRecordingPath: previousPath,
      runRecordingStartedAt: null,
    };
    internals.waitForRecordingStop = vi.fn().mockResolvedValue(undefined);

    await expect(service.stopRunRecording()).resolves.toMatchObject({
      recording: false,
      runRecordingActive: false,
      lastRecordingPath: previousPath,
      runRecordingPath: previousPath,
      error: null,
    });
  });

  it("publishes recorder status only to live windows", () => {
    const liveSend = vi.fn();
    const destroyedSend = vi.fn();
    electronMocks.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send: destroyedSend } },
      { isDestroyed: () => false, webContents: { send: liveSend } },
    ]);
    const service = createService();
    const internals = service as unknown as {
      publishStatus(): void;
    };

    internals.publishStatus();

    expect(destroyedSend).not.toHaveBeenCalled();
    expect(liveSend).toHaveBeenCalledWith(
      ManagedRecorderChannel.StatusChanged,
      service.getStatus(),
    );
  });
});
