import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ManagedRecorderStatus } from "~/types";

const storeMocks = vi.hoisted(() => ({
  close: vi.fn(),
  maximize: vi.fn(),
  minimize: vi.fn(),
  openWhatsNew: vi.fn(),
  status: null as ManagedRecorderStatus | null,
  toggleRecorderOverlay: vi.fn(),
  unmaximize: vi.fn(),
  useAppMenu: vi.fn(),
  useManagedRecorderSelector: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/renderer/modules/updater/UpdateIndicator/UpdateIndicator", () => ({
  default: () => null,
}));
vi.mock("../DiskSpaceWarning/DiskSpaceWarning", () => ({
  default: () => null,
}));
vi.mock("../WhatsNewModal/WhatsNewModal", () => ({
  default: () => null,
}));
vi.mock("~/renderer/store", () => ({
  useAppMenu: storeMocks.useAppMenu,
  useManagedRecorderSelector: storeMocks.useManagedRecorderSelector,
}));

import AppControls from "./AppControls";

let container: HTMLDivElement;
let root: Root;

function createStatus(
  overrides: Partial<ManagedRecorderStatus> = {},
): ManagedRecorderStatus {
  return {
    activeSessionDirectory: null,
    available: true,
    bufferActive: false,
    encoder: "h264",
    error: null,
    fps: 60,
    gameRunning: true,
    initialized: true,
    isStartingRecording: false,
    isStoppingRecording: false,
    lastRecordingPath: null,
    outputDirectory: "C:\\Videos",
    outputResolution: "1920x1080",
    recording: false,
    recordingStartedAt: null,
    runRecordingActive: false,
    runRecordingPath: null,
    runRecordingStartedAt: null,
    runtime: "packaged_obs",
    runtimePath: "obs.exe",
    ...overrides,
  };
}

async function renderControls(): Promise<HTMLButtonElement> {
  await act(async () => {
    root.render(<AppControls />);
  });

  const button = container.querySelector<HTMLButtonElement>(
    "[data-onboarding='overlay-icon']",
  );
  if (!button) {
    throw new Error("Expected recorder overlay button to render");
  }

  return button;
}

describe("AppControls", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.status = createStatus();
    storeMocks.useAppMenu.mockReturnValue({
      close: storeMocks.close,
      isMaximized: false,
      isRecorderOverlayVisible: false,
      maximize: storeMocks.maximize,
      minimize: storeMocks.minimize,
      openWhatsNew: storeMocks.openWhatsNew,
      toggleRecorderOverlay: storeMocks.toggleRecorderOverlay,
      unmaximize: storeMocks.unmaximize,
    });
    storeMocks.useManagedRecorderSelector.mockImplementation((selector) =>
      selector({ status: storeMocks.status }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("disables the recorder overlay button when recording cannot start globally", async () => {
    storeMocks.status = createStatus({ gameRunning: false });

    const button = await renderControls();

    expect(button.disabled).toBe(true);
    expect(button.title).toBe(
      "Start the selected Path of Exile game before opening the recorder overlay.",
    );

    await act(async () => {
      button.click();
    });

    expect(storeMocks.toggleRecorderOverlay).not.toHaveBeenCalled();
  });

  it("keeps the recorder overlay button available while rewind or session recording is active", async () => {
    storeMocks.status = createStatus({
      bufferActive: true,
      runRecordingActive: true,
    });

    const button = await renderControls();

    expect(button.disabled).toBe(false);
    expect(button.title).toBe("Show Overlay");

    await act(async () => {
      button.click();
    });

    expect(storeMocks.toggleRecorderOverlay).toHaveBeenCalledTimes(1);
  });
});
