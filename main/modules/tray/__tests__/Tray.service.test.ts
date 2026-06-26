import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type TrayActions, TrayService } from "../Tray.service";

const electronMocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(
    (template: Electron.MenuItemConstructorOptions[]) => template,
  ),
  createFromDataURL: vi.fn(),
  createFromPath: vi.fn(),
  getAppPath: vi.fn(() => "C:\\repo\\Hinekora"),
  isPackaged: true,
  trayFactory: vi.fn(),
  Tray: vi.fn(function Tray(icon: Electron.NativeImage) {
    return electronMocks.trayFactory(icon);
  }),
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: electronMocks.getAppPath,
    get isPackaged() {
      return electronMocks.isPackaged;
    },
  },
  Menu: {
    buildFromTemplate: electronMocks.buildFromTemplate,
  },
  nativeImage: {
    createFromDataURL: electronMocks.createFromDataURL,
    createFromPath: electronMocks.createFromPath,
  },
  Tray: electronMocks.Tray,
}));

class FakeNativeImage {
  constructor(private readonly empty = false) {}

  isEmpty = vi.fn(() => this.empty);
  resize = vi.fn(() => this);
  setTemplateImage = vi.fn();
}

class FakeTray {
  clickListener: (() => void) | null = null;
  contextMenu: Electron.MenuItemConstructorOptions[] | null = null;

  destroy = vi.fn();
  on = vi.fn((event: string, listener: () => void) => {
    if (event === "click") {
      this.clickListener = listener;
    }
  });
  setContextMenu = vi.fn((menu: Electron.MenuItemConstructorOptions[]) => {
    this.contextMenu = menu;
  });
  setIgnoreDoubleClickEvents = vi.fn();
  setToolTip = vi.fn();
}

function resetSingleton(): void {
  (TrayService as unknown as { instance: TrayService | null }).instance = null;
}

function createTrayActions(overrides: Partial<TrayActions> = {}): TrayActions {
  return {
    openDiscord: vi.fn(),
    openGitHub: vi.fn(),
    openHelp: vi.fn(),
    quitApplication: vi.fn(),
    showMainWindow: vi.fn(),
    ...overrides,
  };
}

describe("TrayService", () => {
  beforeEach(() => {
    electronMocks.createFromDataURL.mockImplementation(
      () => new FakeNativeImage(),
    );
  });

  afterEach(() => {
    electronMocks.buildFromTemplate.mockClear();
    electronMocks.createFromDataURL.mockReset();
    electronMocks.createFromPath.mockReset();
    electronMocks.getAppPath.mockReset();
    electronMocks.getAppPath.mockReturnValue("C:\\repo\\Hinekora");
    electronMocks.isPackaged = true;
    electronMocks.Tray.mockClear();
    electronMocks.trayFactory.mockReset();
    resetSingleton();
    vi.restoreAllMocks();
  });

  it("creates and reuses the singleton instance", () => {
    const first = TrayService.getInstance();
    const second = TrayService.getInstance();

    expect(first).toBe(second);
  });

  it("creates a Windows tray icon from the packaged ICO asset", () => {
    const image = new FakeNativeImage();
    const tray = new FakeTray();
    const showMainWindow = vi.fn();
    const openDiscord = vi.fn();
    const openGitHub = vi.fn();
    const openHelp = vi.fn();
    const quitApplication = vi.fn();
    const originalPlatform = process.platform;
    const originalResourcesPath = process.resourcesPath;
    electronMocks.createFromPath.mockReturnValue(image);
    electronMocks.trayFactory.mockReturnValue(tray);

    try {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: "C:\\resources",
      });

      const service = new TrayService();
      expect(
        service.createTray(
          createTrayActions({
            openDiscord,
            openGitHub,
            openHelp,
            quitApplication,
            showMainWindow,
          }),
        ),
      ).toBe(tray);

      expect(electronMocks.createFromPath).toHaveBeenCalledWith(
        join("C:\\resources", "logo", "windows", "icon.ico"),
      );
      expect(electronMocks.Tray).toHaveBeenCalledWith(image);
      expect(tray.setToolTip).toHaveBeenCalledWith("Hinekora");
      expect(tray.setIgnoreDoubleClickEvents).toHaveBeenCalledWith(true);

      tray.clickListener?.();
      expect(showMainWindow).toHaveBeenCalledTimes(1);

      (tray.contextMenu?.[0]?.click as (() => void) | undefined)?.();
      expect(showMainWindow).toHaveBeenCalledTimes(2);

      expect(tray.contextMenu?.map((item) => item.label ?? item.type)).toEqual([
        "Show Hinekora",
        "separator",
        "Help",
        "separator",
        "GitHub",
        "Discord",
        "separator",
        "Quit Hinekora",
      ]);
      expect(electronMocks.createFromDataURL).toHaveBeenCalledTimes(5);
      expect(
        tray.contextMenu
          ?.filter((item) => item.type !== "separator")
          .every((item) => item.icon instanceof FakeNativeImage),
      ).toBe(true);

      (tray.contextMenu?.[2]?.click as (() => void) | undefined)?.();
      expect(openHelp).toHaveBeenCalledTimes(1);

      (tray.contextMenu?.[4]?.click as (() => void) | undefined)?.();
      expect(openGitHub).toHaveBeenCalledTimes(1);

      (tray.contextMenu?.[5]?.click as (() => void) | undefined)?.();
      expect(openDiscord).toHaveBeenCalledTimes(1);

      (tray.contextMenu?.[7]?.click as (() => void) | undefined)?.();
      expect(quitApplication).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: originalResourcesPath,
      });
    }
  });

  it("uses renderer assets in development and template images on macOS", () => {
    const image = new FakeNativeImage();
    const tray = new FakeTray();
    const originalPlatform = process.platform;
    electronMocks.createFromPath.mockReturnValue(image);
    electronMocks.trayFactory.mockReturnValue(tray);
    electronMocks.isPackaged = false;

    try {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "darwin",
      });

      new TrayService().createTray(createTrayActions());

      expect(electronMocks.createFromPath).toHaveBeenCalledWith(
        join(
          "C:\\repo\\Hinekora",
          "renderer",
          "assets",
          "logo",
          "macos",
          "16x16.png",
        ),
      );
      expect(image.setTemplateImage).toHaveBeenCalledWith(true);
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      electronMocks.isPackaged = true;
    }
  });

  it("uses the Linux tray icon path", () => {
    const image = new FakeNativeImage();
    const tray = new FakeTray();
    const originalPlatform = process.platform;
    const originalResourcesPath = process.resourcesPath;
    electronMocks.createFromPath.mockReturnValue(image);
    electronMocks.trayFactory.mockReturnValue(tray);

    try {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "linux",
      });
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: "/opt/hinekora/resources",
      });

      new TrayService().createTray(createTrayActions());

      expect(electronMocks.createFromPath).toHaveBeenCalledWith(
        join("/opt/hinekora/resources", "logo", "linux", "icons", "32x32.png"),
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: originalResourcesPath,
      });
    }
  });

  it("logs when the tray icon asset cannot be loaded", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const expectedIconFile =
      process.platform === "darwin"
        ? "16x16.png"
        : process.platform === "linux"
          ? "32x32.png"
          : "icon.ico";
    electronMocks.createFromPath.mockReturnValue(new FakeNativeImage(true));
    electronMocks.trayFactory.mockReturnValue(new FakeTray());

    new TrayService().createTray(createTrayActions());

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Tray icon failed to load"),
      expect.objectContaining({
        iconFile: expectedIconFile,
        iconHash: expect.any(String),
      }),
    );
    warn.mockRestore();
  });

  it("reuses an existing tray while refreshing actions and menu", () => {
    const image = new FakeNativeImage();
    const tray = new FakeTray();
    const firstShow = vi.fn();
    const secondShow = vi.fn();
    electronMocks.createFromPath.mockReturnValue(image);
    electronMocks.trayFactory.mockReturnValue(tray);
    const service = new TrayService();

    service.createTray(createTrayActions({ showMainWindow: firstShow }));
    service.createTray(createTrayActions({ showMainWindow: secondShow }));

    expect(electronMocks.Tray).toHaveBeenCalledTimes(1);
    expect(tray.setContextMenu).toHaveBeenCalledTimes(2);

    tray.clickListener?.();
    expect(firstShow).not.toHaveBeenCalled();
    expect(secondShow).toHaveBeenCalledTimes(1);
  });

  it("destroys the current tray and clears callbacks", () => {
    const image = new FakeNativeImage();
    const tray = new FakeTray();
    electronMocks.createFromPath.mockReturnValue(image);
    electronMocks.trayFactory.mockReturnValue(tray);
    const service = new TrayService();

    service.createTray(createTrayActions());

    expect(service.getTray()).toBe(tray);

    service.destroyTray();

    expect(tray.destroy).toHaveBeenCalled();
    expect(service.getTray()).toBeNull();

    service.destroyTray();
    expect(tray.destroy).toHaveBeenCalledTimes(1);
  });
});
