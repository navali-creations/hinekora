import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordingStorageUsage } from "~/main/modules/recording-storage/RecordingStorage.dto";

const storeMocks = vi.hoisted(() => ({
  isAppHydrated: true,
  isUsageLoading: false,
  navigate: vi.fn(),
  recordingMaxStorageGb: 48,
  refreshUsage: vi.fn(),
  usage: null as RecordingStorageUsage | null,
  usageError: null as string | null,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => storeMocks.navigate,
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: (selector: (state: { isHydrated: boolean }) => unknown) =>
    selector({ isHydrated: storeMocks.isAppHydrated }),
  useRecordingStorageShallow: (
    selector: (recordingStorage: {
      isUsageLoading: boolean;
      refreshUsage: typeof storeMocks.refreshUsage;
      usage: RecordingStorageUsage | null;
      usageError: string | null;
    }) => unknown,
  ) =>
    selector({
      isUsageLoading: storeMocks.isUsageLoading,
      refreshUsage: storeMocks.refreshUsage,
      usage: storeMocks.usage,
      usageError: storeMocks.usageError,
    }),
  useSettingsSelector: (
    selector: (settings: {
      value: {
        recordingMaxStorageGb: number;
      };
    }) => unknown,
  ) =>
    selector({
      value: {
        recordingMaxStorageGb: storeMocks.recordingMaxStorageGb,
      },
    }),
}));

import { AppStorageUsageMeter } from "./AppStorageUsageMeter";

const GIGABYTE = 1024 ** 3;
let container: HTMLDivElement;
let root: Root;

function createUsage(): RecordingStorageUsage {
  return {
    clipsSizeBytes: 0.1 * GIGABYTE,
    diskFreeBytes: 100 * GIGABYTE,
    lowDiskSpace: false,
    recordingsSizeBytes: 0.2 * GIGABYTE,
  };
}

async function renderMeter(): Promise<HTMLButtonElement> {
  await act(async () => {
    root.render(<AppStorageUsageMeter />);
  });

  const button = container.querySelector("button");
  if (!button) {
    throw new Error("Expected storage usage meter to render");
  }

  return button;
}

describe("AppStorageUsageMeter", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.isAppHydrated = true;
    storeMocks.isUsageLoading = false;
    storeMocks.recordingMaxStorageGb = 48;
    storeMocks.refreshUsage.mockResolvedValue(undefined);
    storeMocks.usage = createUsage();
    storeMocks.usageError = null;
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows clip and recording usage against the configured limit", async () => {
    const button = await renderMeter();
    const progress = container.querySelector('[role="progressbar"]');

    expect(button.textContent).toContain("0.3 GB / 48 GB");
    expect(button.getAttribute("aria-label")).toBe(
      "0.3 GB used of 48 GB. Open data and storage settings",
    );
    expect(Number(progress?.getAttribute("aria-valuenow"))).toBeCloseTo(0.625);
    expect(storeMocks.refreshUsage).not.toHaveBeenCalled();
  });

  it("loads usage only when no snapshot is available", async () => {
    storeMocks.usage = null;

    await renderMeter();

    await vi.waitFor(() => {
      expect(storeMocks.refreshUsage).toHaveBeenCalledTimes(1);
    });
  });

  it("defers its initial usage read until the browser is idle", async () => {
    let idleCallback: IdleRequestCallback | null = null;
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 7;
    });
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);
    storeMocks.usage = null;

    await renderMeter();

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 3_000,
    });
    expect(storeMocks.refreshUsage).not.toHaveBeenCalled();
    await act(async () => {
      idleCallback?.({
        didTimeout: false,
        timeRemaining: () => 10,
      });
    });
    expect(storeMocks.refreshUsage).toHaveBeenCalledTimes(1);
  });

  it("waits for application hydration before loading usage", async () => {
    storeMocks.isAppHydrated = false;
    storeMocks.usage = null;

    await renderMeter();
    await new Promise((resolvePromise) => window.setTimeout(resolvePromise, 0));

    expect(storeMocks.refreshUsage).not.toHaveBeenCalled();
  });

  it("opens the data and storage settings tab", async () => {
    const button = await renderMeter();

    expect(button.hasAttribute("title")).toBe(false);
    expect(button.closest(".tooltip")?.getAttribute("data-tip")).toBe(
      "Open data and storage settings",
    );
    expect(button.closest(".tooltip")?.classList.contains("tooltip-left")).toBe(
      true,
    );

    await act(async () => {
      button.click();
    });

    expect(storeMocks.navigate).toHaveBeenCalledWith({
      to: "/settings",
      search: { tab: "data-storage" },
    });
  });

  it("renders the unlimited and loading states", async () => {
    storeMocks.recordingMaxStorageGb = 0;
    let button = await renderMeter();

    expect(button.textContent).toContain("0.3 GB / Unlimited");
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("0");

    storeMocks.usage = null;
    storeMocks.isUsageLoading = true;
    button = await renderMeter();

    expect(button.textContent).toContain("-- / Unlimited");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.hasAttribute("aria-valuenow"),
    ).toBe(false);
  });

  it("reports a failed usage read without remaining busy", async () => {
    storeMocks.usageError = "usage failed";
    storeMocks.isUsageLoading = false;
    storeMocks.usage = null;

    const button = await renderMeter();

    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe(
      "Recording storage usage is unavailable. Open data and storage settings",
    );
  });

  it("retries a failed usage read once after a delay", async () => {
    vi.useFakeTimers();
    storeMocks.usageError = "usage failed";
    storeMocks.usage = null;

    await renderMeter();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999);
    });
    expect(storeMocks.refreshUsage).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(storeMocks.refreshUsage).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(storeMocks.refreshUsage).toHaveBeenCalledTimes(1);
  });

  it("retries when a failed read leaves an older snapshot visible", async () => {
    vi.useFakeTimers();
    storeMocks.usageError = "usage failed";

    await renderMeter();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(storeMocks.refreshUsage).toHaveBeenCalledTimes(1);
  });

  it("does not poll after receiving the initial snapshot", async () => {
    vi.useFakeTimers();

    await renderMeter();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    expect(storeMocks.refreshUsage).not.toHaveBeenCalled();
  });

  it("warns when storage is within ten percent of its limit", async () => {
    storeMocks.usage = {
      ...createUsage(),
      clipsSizeBytes: 4 * GIGABYTE,
      recordingsSizeBytes: 40 * GIGABYTE,
    };

    await renderMeter();

    const warning = container.querySelector('[role="status"]');
    expect(warning?.getAttribute("data-tip")).toBe(
      "Storage is within 10% of its limit. Once full, the oldest recordings and clips will be deleted and replaced by new recordings and clips.",
    );
    expect(warning?.getAttribute("tabindex")).toBe("0");
    expect(
      container.querySelector('[role="progressbar"] span')?.className,
    ).toContain("bg-warning");
  });
});
