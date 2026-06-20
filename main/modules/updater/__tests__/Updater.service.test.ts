import { afterEach, describe, expect, it, vi } from "vitest";

import { mockIpcMainHandlers } from "~/main/test/ipc";

import { UpdaterChannel } from "../Updater.channels";
import { UpdaterService } from "../Updater.service";

const electronMocks = vi.hoisted(() => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const autoUpdater = {
    checkForUpdates: vi.fn(),
    emit: (event: string, ...args: unknown[]) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return autoUpdater;
    }),
    quitAndInstall: vi.fn(),
    reset: () => {
      listeners.clear();
      autoUpdater.checkForUpdates.mockReset();
      autoUpdater.on.mockClear();
      autoUpdater.quitAndInstall.mockReset();
      autoUpdater.setFeedURL.mockReset();
    },
    setFeedURL: vi.fn(),
  };

  return {
    autoUpdater,
    getAppPath: vi.fn(),
    getVersion: vi.fn(),
    isPackaged: false,
    openExternal: vi.fn(),
  };
});

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();

  return {
    ...actual,
    existsSync: fsMocks.existsSync,
    readFileSync: fsMocks.readFileSync,
  };
});

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return electronMocks.isPackaged;
    },
    getAppPath: electronMocks.getAppPath,
    getVersion: electronMocks.getVersion,
  },
  autoUpdater: electronMocks.autoUpdater,
  shell: {
    openExternal: electronMocks.openExternal,
  },
}));

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  process,
  "platform",
);
const originalResourcesPathDescriptor = Object.getOwnPropertyDescriptor(
  process,
  "resourcesPath",
);

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", {
    configurable: true,
    enumerable: true,
    value: platform,
  });
}

function createWindow(send = vi.fn()) {
  return {
    webContents: { send },
  } as unknown as Electron.BrowserWindow;
}

function createPackagedLinuxUpdater(
  options: {
    fetch?: typeof fetch;
    openExternal?: (url: string) => Promise<void>;
    version?: string;
  } = {},
): UpdaterService {
  setPlatform("linux");
  electronMocks.isPackaged = true;
  electronMocks.getAppPath.mockReturnValue(process.cwd());
  electronMocks.getVersion.mockReturnValue(options.version ?? "1.0.0");
  if (options.fetch) {
    vi.stubGlobal("fetch", options.fetch);
  }
  if (options.openExternal) {
    electronMocks.openExternal.mockImplementation(options.openExternal);
  }

  return new UpdaterService();
}

function createJsonFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Server Error",
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  electronMocks.autoUpdater.reset();
  electronMocks.getAppPath.mockReset();
  electronMocks.getVersion.mockReset();
  electronMocks.isPackaged = false;
  electronMocks.openExternal.mockReset();
  fsMocks.existsSync.mockReset();
  fsMocks.readFileSync.mockReset();
  if (originalPlatformDescriptor) {
    Object.defineProperty(process, "platform", originalPlatformDescriptor);
  }
  if (originalResourcesPathDescriptor) {
    Object.defineProperty(
      process,
      "resourcesPath",
      originalResourcesPathDescriptor,
    );
  } else {
    Reflect.deleteProperty(process, "resourcesPath");
  }
  delete (UpdaterService as unknown as { _instance?: UpdaterService })
    ._instance;
});

describe("UpdaterService parsing helpers", () => {
  it("compares semantic versions", () => {
    const service = new UpdaterService();
    const internals = service as unknown as {
      isNewerVersion(current: string, latest: string): boolean;
      parseVersionFromName(name: string | null): string;
    };

    expect(internals.isNewerVersion("1.2.3", "1.2.4")).toBe(true);
    expect(internals.isNewerVersion("1.2.3", "1.3.0")).toBe(true);
    expect(internals.isNewerVersion("1.2.3", "2.0.0")).toBe(true);
    expect(internals.isNewerVersion("1.2.3", "1.2.3")).toBe(false);
    expect(internals.isNewerVersion("1.2.3", "1.2.2")).toBe(false);
    expect(internals.parseVersionFromName("Hinekora v2.3.4")).toBe("2.3.4");
    expect(internals.parseVersionFromName(null)).toBe("0.0.0");
    expect(internals.parseVersionFromName("latest")).toBe("latest");
  });

  it("parses changelog releases, rich entries, subitems, and markdown content", () => {
    const service = new UpdaterService();
    const internals = service as unknown as {
      parseChangelog(markdown: string): unknown;
    };

    expect(
      internals.parseChangelog(`
## 1.2.0

### Patch Changes

- [\`abcdef1\`](https://github.com/navali-creations/hinekora/commit/abcdef1) Thanks [@seb](https://github.com/seb)! - Fix updater
More context
  - Keep Squirrel path intact
  - Keep updater status stable

#### Notes

Extra markdown.

### Minor Changes

- 1234567: Add overlays

### Patch Changes

- [\`fedcba9\`](https://github.com/navali-creations/hinekora/commit/fedcba9) Thanks [@seb](https://github.com/seb)!
# Ignored heading continuation

## 1.1.0

- Plain entry
`),
    ).toEqual([
      {
        version: "1.2.0",
        changeType: "Minor Changes",
        entries: [
          {
            description: "Fix updater More context",
            commitHash: "abcdef1",
            commitUrl:
              "https://github.com/navali-creations/hinekora/commit/abcdef1",
            contributor: "seb",
            contributorUrl: "https://github.com/seb",
            subItems: [
              "Keep Squirrel path intact",
              "Keep updater status stable",
            ],
            content: "#### Notes\n\nExtra markdown.",
          },
          {
            description: "Add overlays",
            commitHash: "1234567",
          },
          {
            description: "",
            commitHash: "fedcba9",
            commitUrl:
              "https://github.com/navali-creations/hinekora/commit/fedcba9",
            contributor: "seb",
            contributorUrl: "https://github.com/seb",
          },
        ],
      },
      {
        version: "1.1.0",
        changeType: "Changes",
        entries: [{ description: "Plain entry" }],
      },
    ]);
    expect(
      internals.parseChangelog(`
## 1.0.0

- Empty content


`),
    ).toEqual([
      {
        version: "1.0.0",
        changeType: "Changes",
        entries: [{ description: "Empty content" }],
      },
    ]);
    expect(
      internals.parseChangelog(`
## 1.0.1

- Parent
  -    

#### Empty section
`),
    ).toEqual([
      {
        version: "1.0.1",
        changeType: "Changes",
        entries: [
          {
            description: "Parent",
            content: "#### Empty section",
          },
        ],
      },
    ]);

    expect(
      internals.parseChangelog(`
## 1.0.2

- Paragraph content

Body paragraph
Second paragraph

- Heading content

#### First
#### Second
`),
    ).toEqual([
      {
        version: "1.0.2",
        changeType: "Changes",
        entries: [
          {
            description: "Paragraph content",
            content: "Body paragraph\nSecond paragraph",
          },
          {
            description: "Heading content",
            content: "#### First\n#### Second",
          },
        ],
      },
    ]);
  });

  it("maps GitHub release bodies to renderer release info", () => {
    const service = new UpdaterService();
    const internals = service as unknown as {
      isTrustedReleaseUrl(value: string | null | undefined): boolean;
      resolveTrustedReleaseUrl(value: string | null | undefined): string;
      toLatestReleaseInfo(release: unknown): unknown;
    };

    expect(
      internals.toLatestReleaseInfo({
        tag_name: "v3.0.0",
        name: "",
        body: "### Major Changes\n\n- Breaking change",
        published_at: "2026-06-12T10:00:00.000Z",
        html_url:
          "https://github.com/navali-creations/hinekora/releases/v3.0.0",
      }),
    ).toEqual({
      version: "3.0.0",
      name: "v3.0.0",
      body: "### Major Changes\n\n- Breaking change",
      publishedAt: "2026-06-12T10:00:00.000Z",
      url: "https://github.com/navali-creations/hinekora/releases/v3.0.0",
      changeType: "Major Changes",
      entries: [{ description: "Breaking change" }],
    });
    expect(
      internals.toLatestReleaseInfo({
        tag_name: "v3.0.1",
        name: "Patch",
        body: null,
        published_at: "2026-06-12T10:00:00.000Z",
        html_url:
          "https://github.com/navali-creations/hinekora/releases/v3.0.1",
      }),
    ).toEqual({
      version: "3.0.1",
      name: "Patch",
      body: "",
      publishedAt: "2026-06-12T10:00:00.000Z",
      url: "https://github.com/navali-creations/hinekora/releases/v3.0.1",
      changeType: "Changes",
      entries: [],
    });
    expect(
      internals.resolveTrustedReleaseUrl("https://example.test/release"),
    ).toBe("https://github.com/navali-creations/hinekora/releases/latest");
    expect(internals.resolveTrustedReleaseUrl(null)).toBe(
      "https://github.com/navali-creations/hinekora/releases/latest",
    );
    expect(internals.resolveTrustedReleaseUrl("not a url")).toBe(
      "https://github.com/navali-creations/hinekora/releases/latest",
    );
    expect(internals.isTrustedReleaseUrl(null)).toBe(false);
    expect(internals.isTrustedReleaseUrl("not a url")).toBe(false);
    expect(internals.isTrustedReleaseUrl("https://example.test/release")).toBe(
      false,
    );
    expect(
      internals.isTrustedReleaseUrl(
        "https://github.com/navali-creations/hinekora/releases/v3.0.0",
      ),
    ).toBe(true);
    expect(
      internals.resolveTrustedReleaseUrl(
        "https://github.com/navali-creations/hinekora/releases/v3.0.0",
      ),
    ).toBe("https://github.com/navali-creations/hinekora/releases/v3.0.0");
  });

  it("returns empty release body parsing results for empty changelog bodies", () => {
    const service = new UpdaterService();
    const internals = service as unknown as {
      parseChangelog(markdown: string): Array<{
        changeType: string;
        entries: unknown[];
      }>;
      parseReleaseBody(body: string): unknown;
    };

    expect(internals.parseReleaseBody("")).toEqual({
      changeType: "Changes",
      entries: [],
    });

    const parseChangelog = vi
      .spyOn(internals, "parseChangelog")
      .mockReturnValue([]);

    expect(internals.parseReleaseBody("ignored")).toEqual({
      changeType: "Changes",
      entries: [],
    });
    parseChangelog.mockRestore();
  });

  it("creates and reuses the singleton instance", () => {
    const first = UpdaterService.getInstance();
    const second = UpdaterService.getInstance();

    expect(first).toBe(second);
  });

  it("refuses install when no native update has been downloaded", () => {
    const service = new UpdaterService();

    expect(service.installUpdate()).toEqual({
      success: false,
      error: "No update has been downloaded yet",
    });
    service.destroy();
    expect(
      (service as unknown as { mainWindow: Electron.BrowserWindow | null })
        .mainWindow,
    ).toBeNull();
  });

  it("initializes packaged Linux checks on timers and cleans them up", async () => {
    vi.useFakeTimers();
    const { handle } = mockIpcMainHandlers();
    const service = createPackagedLinuxUpdater({
      fetch: createJsonFetch({
        tag_name: "v1.0.0",
        html_url:
          "https://github.com/navali-creations/hinekora/releases/v1.0.0",
        name: "Hinekora v1.0.0",
        body: "",
        published_at: "2026-06-12T10:00:00.000Z",
      }),
      version: "1.0.0",
    });
    const checkForUpdates = vi
      .spyOn(service, "checkForUpdates")
      .mockReturnValue(null);
    const firstWindow = createWindow();
    const secondWindow = createWindow();

    service.initialize(firstWindow);
    service.initialize(secondWindow);

    expect(
      (service as unknown as { mainWindow: Electron.BrowserWindow }).mainWindow,
    ).toBe(secondWindow);
    expect(handle).toHaveBeenCalledTimes(6);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(checkForUpdates).toHaveBeenCalledTimes(2);

    service.destroy();
    expect(
      (service as unknown as { mainWindow: Electron.BrowserWindow | null })
        .mainWindow,
    ).toBeNull();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("clears a pending initial update check during shutdown", async () => {
    vi.useFakeTimers();
    const service = createPackagedLinuxUpdater({
      fetch: createJsonFetch({
        tag_name: "v1.0.0",
        html_url:
          "https://github.com/navali-creations/hinekora/releases/v1.0.0",
        name: "Hinekora v1.0.0",
        body: "",
        published_at: "2026-06-12T10:00:00.000Z",
      }),
      version: "1.0.0",
    });
    const checkForUpdates = vi
      .spyOn(service, "checkForUpdates")
      .mockReturnValue(null);

    service.initialize(createWindow());
    service.destroy();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(checkForUpdates).not.toHaveBeenCalled();
  });

  it("initializes native updater feeds and skips unsupported native platforms", () => {
    vi.useFakeTimers();
    const { handle } = mockIpcMainHandlers();
    setPlatform("win32");
    electronMocks.isPackaged = true;
    electronMocks.getVersion.mockReturnValue("1.2.3");
    fsMocks.existsSync.mockReturnValue(true);
    const service = new UpdaterService();

    service.initialize(createWindow());

    expect(electronMocks.autoUpdater.setFeedURL).toHaveBeenCalledWith({
      url: expect.stringContaining("/win32-"),
    });
    expect(handle).toHaveBeenCalledTimes(6);

    const unsupported = new UpdaterService();
    setPlatform("freebsd");

    unsupported.initialize(createWindow());

    expect(
      (
        unsupported as unknown as {
          autoUpdaterConfigured: boolean;
        }
      ).autoUpdaterConfigured,
    ).toBe(false);
  });

  it("skips native Windows updater setup when Squirrel Update.exe is missing", () => {
    const { handle } = mockIpcMainHandlers();
    setPlatform("win32");
    electronMocks.isPackaged = true;
    electronMocks.getVersion.mockReturnValue("1.2.3");
    fsMocks.existsSync.mockReturnValue(false);
    const service = new UpdaterService();

    service.initialize(createWindow());

    expect(electronMocks.autoUpdater.setFeedURL).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledTimes(6);
  });

  it("checks GitHub releases on Linux and notifies the renderer when newer", async () => {
    const send = vi.fn();
    const service = createPackagedLinuxUpdater({
      fetch: createJsonFetch({
        tag_name: "v1.2.0",
        html_url:
          "https://github.com/navali-creations/hinekora/releases/v1.2.0",
        name: "",
        body: "Release notes",
        published_at: "2026-06-12T10:00:00.000Z",
      }),
      version: "1.0.0",
    });
    const internals = service as unknown as {
      checkForUpdatesViaGitHub(): Promise<void>;
      mainWindow: { webContents: { send: typeof send } };
      lastUpdateInfo: unknown;
    };
    internals.mainWindow = { webContents: { send } };

    await internals.checkForUpdatesViaGitHub();

    expect(internals.lastUpdateInfo).toMatchObject({
      updateAvailable: true,
      currentVersion: "1.0.0",
      latestVersion: "1.2.0",
      releaseName: "v1.2.0",
      manualDownload: true,
    });
    expect(send).toHaveBeenCalledWith(
      UpdaterChannel.OnUpdateAvailable,
      expect.objectContaining({ latestVersion: "1.2.0" }),
    );
  });

  it("keeps Linux updater idle when GitHub has no newer stable release", async () => {
    const send = vi.fn();
    const service = createPackagedLinuxUpdater({
      fetch: createJsonFetch({
        tag_name: "v1.0.0",
        html_url:
          "https://github.com/navali-creations/hinekora/releases/v1.0.0",
        name: "Hinekora v1.0.0",
        body: "",
        published_at: "2026-06-12T10:00:00.000Z",
      }),
      version: "1.0.0",
    });
    const internals = service as unknown as {
      checkForUpdatesViaGitHub(): Promise<void>;
      mainWindow: { webContents: { send: typeof send } };
      lastUpdateInfo: unknown;
    };
    internals.mainWindow = { webContents: { send } };

    await internals.checkForUpdatesViaGitHub();

    expect(internals.lastUpdateInfo).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("handles GitHub fetch failures without update info", async () => {
    const service = createPackagedLinuxUpdater({
      fetch: createJsonFetch({ message: "nope" }, false),
    });
    const internals = service as unknown as {
      checkForUpdatesViaGitHub(): Promise<void>;
      fetchLatestRelease(): Promise<unknown>;
      fetchRecentReleases(): Promise<unknown[]>;
      lastUpdateInfo: unknown;
    };

    await expect(internals.fetchLatestRelease()).resolves.toBeNull();
    await expect(internals.fetchRecentReleases()).resolves.toEqual([]);

    vi.spyOn(internals, "fetchLatestRelease").mockResolvedValue(null);
    await expect(internals.checkForUpdatesViaGitHub()).resolves.toBeUndefined();
    expect(internals.lastUpdateInfo).toBeNull();
  });

  it("keeps GitHub update checks non-fatal when fetch throws", async () => {
    const service = createPackagedLinuxUpdater({
      fetch: vi
        .fn()
        .mockRejectedValue(
          new Error("network down"),
        ) as unknown as typeof fetch,
    });
    const internals = service as unknown as {
      checkForUpdatesViaGitHub(): Promise<void>;
      lastUpdateInfo: unknown;
    };

    await expect(internals.checkForUpdatesViaGitHub()).resolves.toBeUndefined();
    expect(internals.lastUpdateInfo).toBeNull();
  });

  it("starts Linux update checks through the public check method", async () => {
    const service = createPackagedLinuxUpdater({
      fetch: createJsonFetch({
        tag_name: "v1.1.0",
        html_url:
          "https://github.com/navali-creations/hinekora/releases/v1.1.0",
        name: "Hinekora v1.1.0",
        body: "",
        published_at: "2026-06-12T10:00:00.000Z",
      }),
      version: "1.0.0",
    });
    const internals = service as unknown as {
      lastUpdateInfo: unknown;
      mainWindow: Electron.BrowserWindow;
    };
    internals.mainWindow = createWindow();

    expect(service.checkForUpdates()).toBeNull();
    await vi.waitFor(() => {
      expect(internals.lastUpdateInfo).toMatchObject({
        latestVersion: "1.1.0",
      });
    });
  });

  it("filters recent releases to stable releases only", async () => {
    const service = createPackagedLinuxUpdater({
      fetch: createJsonFetch([
        {
          tag_name: "v1.2.0",
          html_url:
            "https://github.com/navali-creations/hinekora/releases/v1.2.0",
          name: "Stable",
          body: "- Stable",
          published_at: "2026-06-12T10:00:00.000Z",
        },
        {
          tag_name: "v1.3.0-beta",
          html_url: "beta-url",
          name: "Beta",
          body: "",
          published_at: "2026-06-12T10:00:00.000Z",
          prerelease: true,
        },
        {
          tag_name: "v1.4.0",
          html_url: "draft-url",
          name: "Draft",
          body: "",
          published_at: "2026-06-12T10:00:00.000Z",
          draft: true,
        },
      ]),
    });
    const internals = service as unknown as {
      fetchRecentReleases(): Promise<unknown[]>;
    };

    await expect(internals.fetchRecentReleases()).resolves.toEqual([
      expect.objectContaining({ tag_name: "v1.2.0" }),
    ]);
  });

  it("wires native updater events into status and renderer notifications", () => {
    const send = vi.fn();
    setPlatform("win32");
    electronMocks.isPackaged = true;
    electronMocks.getVersion.mockReturnValue("1.0.0");
    const service = new UpdaterService();
    const internals = service as unknown as {
      lastUpdateInfo: unknown;
      mainWindow: { webContents: { send: typeof send } };
      updateDownloaded: boolean;
      updateStatus: string;
      wireAutoUpdaterEvents(): void;
    };
    internals.mainWindow = { webContents: { send } };

    internals.wireAutoUpdaterEvents();
    electronMocks.autoUpdater.emit("checking-for-update");
    electronMocks.autoUpdater.emit("update-available");
    expect(internals.updateStatus).toBe("downloading");
    expect(send).toHaveBeenCalledWith(UpdaterChannel.OnDownloadProgress, {
      percent: -1,
      totalBytes: 0,
      transferredBytes: 0,
    });

    electronMocks.autoUpdater.emit(
      "update-downloaded",
      {},
      "Release notes",
      "Hinekora v2.0.0",
      "2026-06-12T10:00:00.000Z",
      "https://example.test/update",
    );

    expect(internals.updateDownloaded).toBe(true);
    expect(internals.updateStatus).toBe("ready");
    expect(internals.lastUpdateInfo).toMatchObject({
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      manualDownload: false,
    });
    expect(send).toHaveBeenCalledWith(
      UpdaterChannel.OnUpdateAvailable,
      expect.objectContaining({ latestVersion: "2.0.0" }),
    );
    expect(send).toHaveBeenCalledWith(UpdaterChannel.OnDownloadProgress, {
      percent: 100,
      totalBytes: 0,
      transferredBytes: 0,
    });

    electronMocks.autoUpdater.emit("update-not-available");
    expect(internals.updateStatus).toBe("idle");
    electronMocks.autoUpdater.emit("error", new Error("network down"));
    expect(internals.updateStatus).toBe("error");

    electronMocks.autoUpdater.emit(
      "update-downloaded",
      {},
      "",
      "",
      "2026-06-12T10:00:00.000Z",
      "https://github.com/navali-creations/hinekora/releases/v0.0.0",
    );
    expect(internals.lastUpdateInfo).toMatchObject({
      latestVersion: "0.0.0",
      releaseName: "v0.0.0",
      releaseNotes: "",
    });
  });

  it("checks native updater only when packaged and configured", () => {
    setPlatform("win32");
    electronMocks.isPackaged = true;
    electronMocks.getVersion.mockReturnValue("1.0.0");
    const service = new UpdaterService();
    const internals = service as unknown as { autoUpdaterConfigured: boolean };
    internals.autoUpdaterConfigured = true;

    expect(service.checkForUpdates()).toBeNull();
    expect(electronMocks.autoUpdater.checkForUpdates).toHaveBeenCalled();

    electronMocks.isPackaged = false;
    const devService = new UpdaterService();
    expect(devService.checkForUpdates()).toBeNull();
  });

  it("handles native update checks that are unconfigured, unsupported, or failing", () => {
    setPlatform("win32");
    electronMocks.isPackaged = true;
    electronMocks.getVersion.mockReturnValue("1.0.0");
    const unconfigured = new UpdaterService();
    expect(unconfigured.checkForUpdates()).toBeNull();

    setPlatform("freebsd");
    const unsupported = new UpdaterService();
    expect(unsupported.checkForUpdates()).toBeNull();

    setPlatform("win32");
    electronMocks.autoUpdater.checkForUpdates.mockImplementation(() => {
      throw new Error("check failed");
    });
    const failing = new UpdaterService();
    (
      failing as unknown as {
        autoUpdaterConfigured: boolean;
        lastUpdateInfo: unknown;
      }
    ).autoUpdaterConfigured = true;
    (
      failing as unknown as {
        autoUpdaterConfigured: boolean;
        lastUpdateInfo: unknown;
      }
    ).lastUpdateInfo = { latestVersion: "2.0.0" };

    expect(failing.checkForUpdates()).toEqual({ latestVersion: "2.0.0" });
  });

  it("detects Windows Squirrel Update.exe availability", () => {
    setPlatform("darwin");
    const supportedNonWindows = new UpdaterService();
    const supportedNonWindowsInternals = supportedNonWindows as unknown as {
      canUseNativeAutoUpdater(): boolean;
    };
    expect(supportedNonWindowsInternals.canUseNativeAutoUpdater()).toBe(true);

    setPlatform("win32");
    const missing = new UpdaterService();
    const missingInternals = missing as unknown as {
      canUseNativeAutoUpdater(): boolean;
    };
    fsMocks.existsSync.mockReturnValue(false);
    expect(missingInternals.canUseNativeAutoUpdater()).toBe(
      process.platform !== "win32",
    );

    const present = new UpdaterService();
    const presentInternals = present as unknown as {
      canUseNativeAutoUpdater(): boolean;
    };
    fsMocks.existsSync.mockReturnValue(true);
    expect(presentInternals.canUseNativeAutoUpdater()).toBe(true);
  });

  it("opens release pages for Linux installs", () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = createPackagedLinuxUpdater({ openExternal });
    const internals = service as unknown as {
      lastUpdateInfo: { releaseUrl: string } | null;
    };
    internals.lastUpdateInfo = {
      releaseUrl:
        "https://github.com/navali-creations/hinekora/releases/v1.2.0",
    };

    expect(service.installUpdate()).toEqual({ success: true });
    expect(openExternal).toHaveBeenCalledWith(
      "https://github.com/navali-creations/hinekora/releases/v1.2.0",
    );
  });

  it("opens the latest release page when no trusted Linux update info is cached", () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = createPackagedLinuxUpdater({ openExternal });
    const internals = service as unknown as {
      lastUpdateInfo: { releaseUrl: string } | null;
    };

    expect(service.installUpdate()).toEqual({ success: true });
    expect(openExternal).toHaveBeenCalledWith(
      "https://github.com/navali-creations/hinekora/releases/latest",
    );

    openExternal.mockClear();
    internals.lastUpdateInfo = { releaseUrl: "https://example.test/release" };

    expect(service.installUpdate()).toEqual({ success: true });
    expect(openExternal).toHaveBeenCalledWith(
      "https://github.com/navali-creations/hinekora/releases/latest",
    );
  });

  it("runs native quit-and-install only after a downloaded update", () => {
    setPlatform("win32");
    const service = new UpdaterService();
    const internals = service as unknown as { updateDownloaded: boolean };
    internals.updateDownloaded = true;

    expect(service.installUpdate()).toEqual({ success: true });
    expect(electronMocks.autoUpdater.quitAndInstall).toHaveBeenCalled();
  });

  it("returns native install errors without throwing", () => {
    setPlatform("win32");
    electronMocks.autoUpdater.quitAndInstall.mockImplementation(() => {
      throw new Error("install failed");
    });
    const service = new UpdaterService();
    const internals = service as unknown as { updateDownloaded: boolean };
    internals.updateDownloaded = true;

    expect(service.installUpdate()).toEqual({
      success: false,
      error: "install failed",
    });
  });

  it("returns unknown native install errors without throwing", () => {
    setPlatform("win32");
    electronMocks.autoUpdater.quitAndInstall.mockImplementation(() => {
      throw "install failed";
    });
    const service = new UpdaterService();
    const internals = service as unknown as { updateDownloaded: boolean };
    internals.updateDownloaded = true;

    expect(service.installUpdate()).toEqual({
      success: false,
      error: "Unknown install error",
    });
  });

  it("registers IPC handlers for update and release metadata", async () => {
    const { handlers } = mockIpcMainHandlers();
    setPlatform("linux");
    electronMocks.isPackaged = false;
    electronMocks.getAppPath.mockReturnValue(process.cwd());
    electronMocks.getVersion.mockReturnValue("1.0.0");
    vi.stubGlobal(
      "fetch",
      createJsonFetch([
        {
          tag_name: "v1.1.0",
          html_url:
            "https://github.com/navali-creations/hinekora/releases/v1.1.0",
          name: "Hinekora v1.1.0",
          body: "- Fix one",
          published_at: "2026-06-12T10:00:00.000Z",
        },
      ]),
    );
    fsMocks.readFileSync.mockReturnValue("## 1.1.0\n\n- Changelog entry");
    electronMocks.openExternal.mockResolvedValue(undefined);
    const service = new UpdaterService();
    service.initialize({
      webContents: { send: vi.fn() },
    } as unknown as Electron.BrowserWindow);

    expect(await handlers.get(UpdaterChannel.CheckForUpdates)?.({})).toBeNull();
    expect(await handlers.get(UpdaterChannel.GetUpdateInfo)?.({})).toBeNull();
    expect(await handlers.get(UpdaterChannel.DownloadUpdate)?.({})).toEqual({
      success: true,
    });
    expect(await handlers.get(UpdaterChannel.InstallUpdate)?.({})).toEqual({
      success: true,
    });
    expect(await handlers.get(UpdaterChannel.GetRecentReleases)?.({})).toEqual([
      expect.objectContaining({
        version: "1.1.0",
        entries: [{ description: "Fix one" }],
      }),
    ]);
    expect(await handlers.get(UpdaterChannel.GetChangelog)?.({})).toEqual({
      success: true,
      releases: [
        {
          version: "1.1.0",
          changeType: "Changes",
          entries: [{ description: "Changelog entry" }],
        },
      ],
    });

    electronMocks.isPackaged = true;
    Object.defineProperty(process, "resourcesPath", {
      configurable: true,
      value: "C:/Hinekora/resources",
    });
    fsMocks.readFileSync.mockClear();
    fsMocks.readFileSync.mockReturnValue("## 1.2.0\n\n- Packaged entry");

    expect(await handlers.get(UpdaterChannel.GetChangelog)?.({})).toEqual({
      success: true,
      releases: [
        {
          version: "1.2.0",
          changeType: "Changes",
          entries: [{ description: "Packaged entry" }],
        },
      ],
    });
    expect(fsMocks.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining("CHANGELOG.md"),
      "utf-8",
    );
  });

  it("handles updater IPC failure paths and non-Linux download states", async () => {
    const { handlers } = mockIpcMainHandlers();
    setPlatform("win32");
    electronMocks.isPackaged = false;
    electronMocks.getAppPath.mockReturnValue(process.cwd());
    electronMocks.getVersion.mockReturnValue("1.0.0");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new Error("network down"),
        ) as unknown as typeof fetch,
    );
    fsMocks.readFileSync.mockImplementation(() => {
      throw new Error("missing changelog");
    });
    const service = new UpdaterService();
    const checkForUpdates = vi
      .spyOn(service, "checkForUpdates")
      .mockReturnValue(null);
    service.initialize(createWindow());

    expect(await handlers.get(UpdaterChannel.DownloadUpdate)?.({})).toEqual({
      success: true,
    });
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    (
      service as unknown as {
        updateStatus: string;
      }
    ).updateStatus = "downloading";
    expect(await handlers.get(UpdaterChannel.DownloadUpdate)?.({})).toEqual({
      success: true,
    });
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    expect(await handlers.get(UpdaterChannel.GetRecentReleases)?.({})).toEqual(
      [],
    );
    expect(await handlers.get(UpdaterChannel.GetChangelog)?.({})).toEqual({
      success: false,
      releases: [],
      error: "missing changelog",
    });
  });
});
