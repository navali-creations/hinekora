import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GIGABYTE = 1024 ** 3;
const storeMocks = vi.hoisted(() => ({
  isHydrated: true,
  refreshUsage: vi.fn(),
  settings: {
    editorExportMaxStorageGb: 50,
    recordingMaxStorageGb: 50,
  },
  usage: {
    clipsSizeBytes: 5 * 1024 ** 3,
    diskFreeBytes: 100 * 1024 ** 3,
    exportVideosSizeBytes: 60 * 1024 ** 3,
    exportVideosUsageTruncated: false,
    lowDiskSpace: false,
    recordingsSizeBytes: 40 * 1024 ** 3,
  },
  usageError: null as string | null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a href="#settings" {...props}>
      {children}
    </a>
  ),
}));
vi.mock("~/renderer/store", () => ({
  useBoundStore: (selector: (state: { isHydrated: boolean }) => unknown) =>
    selector({ isHydrated: storeMocks.isHydrated }),
  useRecordingStorageShallow: (
    selector: (state: {
      isUsageLoading: boolean;
      refreshUsage: typeof storeMocks.refreshUsage;
      usage: typeof storeMocks.usage | null;
      usageError: string | null;
    }) => unknown,
  ) =>
    selector({
      isUsageLoading: false,
      refreshUsage: storeMocks.refreshUsage,
      usage: storeMocks.usage,
      usageError: storeMocks.usageError,
    }),
  useSettingsShallow: (
    selector: (state: { value: typeof storeMocks.settings }) => unknown,
  ) => selector({ value: storeMocks.settings }),
}));

import { SidebarStorageUsage } from "./SidebarStorageUsage";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  storeMocks.settings = {
    editorExportMaxStorageGb: 50,
    recordingMaxStorageGb: 50,
  };
  storeMocks.usage = {
    clipsSizeBytes: 5 * GIGABYTE,
    diskFreeBytes: 100 * GIGABYTE,
    exportVideosSizeBytes: 60 * GIGABYTE,
    exportVideosUsageTruncated: false,
    lowDiskSpace: false,
    recordingsSizeBytes: 40 * GIGABYTE,
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  document.body.replaceChildren();
});

describe("SidebarStorageUsage", () => {
  it("renders independent recording and export budgets", async () => {
    await act(async () => root.render(<SidebarStorageUsage />));

    const progress = container.querySelectorAll('[role="progressbar"]');
    expect(progress).toHaveLength(2);
    expect(progress[0]?.getAttribute("aria-valuenow")).toBe("90");
    expect(progress[1]?.getAttribute("aria-valuenow")).toBe("100");
    expect(container.textContent).toContain("45 / 50 GB");
    expect(container.textContent).toContain("60 / 50 GB");
    expect(container.textContent).toContain("Recording Storage");
    expect(container.textContent).toContain("Export Storage");
    expect(container.textContent).not.toContain("Available");
    expect(container.querySelector(".bg-warning")).not.toBeNull();
    expect(container.querySelector(".bg-error")).not.toBeNull();
    const warningTooltips = container.querySelectorAll(
      '[role="status"].tooltip.tooltip-left[data-tip]',
    );
    expect(warningTooltips).toHaveLength(2);
    expect(warningTooltips[0]?.getAttribute("data-tip")).toBe(
      "Recording Storage is within 10% of its limit",
    );
    expect(warningTooltips[1]?.getAttribute("data-tip")).toBe(
      "Export Storage limit has been reached",
    );
    expect(warningTooltips[1]?.hasAttribute("title")).toBe(false);
  });

  it("keeps unlimited budgets unfilled and surfaces low disk space", async () => {
    storeMocks.settings = {
      editorExportMaxStorageGb: 0,
      recordingMaxStorageGb: 0,
    };
    storeMocks.usage = { ...storeMocks.usage, lowDiskSpace: true };

    await act(async () => root.render(<SidebarStorageUsage />));

    expect(container.textContent).toContain("Unlimited");
    expect(container.textContent).toContain("45 / Unlimited");
    expect(container.textContent).toContain("60 / Unlimited");
    expect(
      container.querySelectorAll('[role="progressbar"][aria-valuenow]'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('[role="progressbar"] > span'),
    ).toHaveLength(0);
    expect(
      container.querySelector(
        '[aria-label="Recording drive space is critically low"]',
      ),
    ).not.toBeNull();
  });

  it("labels a bounded export scan as partial", async () => {
    storeMocks.usage = {
      ...storeMocks.usage,
      exportVideosSizeBytes: 2 * GIGABYTE,
      exportVideosUsageTruncated: true,
    };

    await act(async () => root.render(<SidebarStorageUsage />));

    expect(container.textContent).toContain("≥2 / 50 GB");
    expect(
      container.querySelector(
        '[aria-label*="Export usage is partial because the library is very large"]',
      ),
    ).not.toBeNull();
  });
});
