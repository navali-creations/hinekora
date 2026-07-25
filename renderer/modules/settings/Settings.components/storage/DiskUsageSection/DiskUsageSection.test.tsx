import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageInfo } from "~/main/modules/storage/Storage.dto";

import DiskUsageSection from "./DiskUsageSection";

const info: StorageInfo = {
  appInstallationOnStorageDrive: true,
  appInstallationSizeBytes: 20,
  breakdown: [
    {
      category: "export-videos",
      fileCount: 1,
      label: "Hinekora export videos",
      sizeBytes: 100,
    },
  ],
  calculatedAt: "2026-07-21T00:00:00.000Z",
  databaseOnStorageDrive: true,
  databaseSizeBytes: 10,
  diskFreeBytes: 500,
  diskTotalBytes: 1_000,
  exportStorageVolumes: [
    {
      diskFreeBytes: 500,
      diskTotalBytes: 1_000,
      exportVideosSizeBytes: 100,
      id: "storage-volume-1",
      isRecordingStorage: true,
      path: "C:\\**\\Hinekora Exports",
    },
  ],
  exportVideosUsageTruncated: false,
  recordingUsageTruncated: false,
  recordingsSizeBytes: 200,
  rewindBufferEstimateBytes: 0,
  storagePath: "C:\\**\\Hinekora Recordings",
  temporarySizeBytes: 30,
  totalTrackedSizeBytes: 360,
};

let container: HTMLDivElement;
let root: Root;
const revealPaths = vi.fn();

beforeEach(() => {
  revealPaths.mockReset();
  revealPaths.mockResolvedValue({
    databasePath: "C:\\App\\hinekora.sqlite",
    exportStoragePath: "C:\\Videos\\Hinekora Exports",
    exportStorageVolumes: [
      { id: "storage-volume-1", path: "C:\\Videos\\Hinekora Exports" },
      { id: "storage-volume-2", path: "D:\\Legacy\\Exports" },
    ],
    storagePath: "C:\\Videos\\Hinekora Recordings",
  });
  Object.defineProperty(window, "electron", {
    configurable: true,
    value: { storage: { revealPaths } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  document.body.replaceChildren();
});

describe("DiskUsageSection", () => {
  it("shows recordings and exports as separate categories on one drive", async () => {
    await act(async () => {
      root.render(<DiskUsageSection info={info} />);
    });

    expect(container.textContent).toContain("Hinekora Recordings");
    expect(container.textContent).toContain("Hinekora Exports");
    expect(container.textContent).toContain("Hinekora export videos");
    expect(
      container
        .querySelector('[title^="Hinekora Exports:"]')
        ?.classList.contains("bg-sky-400"),
    ).toBe(true);
    expect(
      container.querySelectorAll("button[title='Reveal full path']"),
    ).toHaveLength(1);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("button[title='Reveal full path']")
        ?.click();
    });
    expect(revealPaths).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("C:\\Videos\\Hinekora Recordings");
  });

  it("renders a separate export disk when the folders use different drives", async () => {
    await act(async () => {
      root.render(
        <DiskUsageSection
          info={{
            ...info,
            exportStorageVolumes: [
              {
                diskFreeBytes: 1_500,
                diskTotalBytes: 2_000,
                exportVideosSizeBytes: 100,
                id: "storage-volume-1",
                isRecordingStorage: false,
                path: "C:\\**\\Hinekora Exports",
              },
              {
                diskFreeBytes: 2_500,
                diskTotalBytes: 3_000,
                exportVideosSizeBytes: 25,
                id: "storage-volume-2",
                isRecordingStorage: false,
                path: "D:\\**\\Hinekora\\Exports",
              },
            ],
          }}
        />,
      );
    });

    expect(
      container.querySelectorAll("button[title='Reveal full path']"),
    ).toHaveLength(3);
    expect(container.textContent).toContain("C:\\**\\Hinekora Exports");
    expect(container.textContent).toContain("D:\\**\\Hinekora\\Exports");
    expect(
      container.querySelectorAll('[title^="Hinekora Exports:"].bg-sky-400'),
    ).toHaveLength(2);
  });

  it("marks truncated export totals as partial", async () => {
    await act(async () => {
      root.render(
        <DiskUsageSection
          info={{ ...info, exportVideosUsageTruncated: true }}
        />,
      );
    });

    expect(container.textContent).toContain("Storage totals are partial");
    expect(container.textContent).toContain(">=100 B");
  });

  it("marks only recording inventory categories as partial", async () => {
    await act(async () => {
      root.render(
        <DiskUsageSection
          info={{
            ...info,
            breakdown: [
              {
                category: "full-recordings",
                fileCount: 1,
                label: "Full recordings",
                sizeBytes: 200,
              },
              {
                category: "app-installation",
                fileCount: 1,
                label: "App installation",
                sizeBytes: 20,
              },
            ],
            recordingUsageTruncated: true,
          }}
        />,
      );
    });

    expect(
      container.querySelector(
        '[data-testid="storage-breakdown-full-recordings"]',
      )?.textContent,
    ).toContain(">=200 B");
    expect(
      container.querySelector(
        '[data-testid="storage-breakdown-app-installation"]',
      )?.textContent,
    ).not.toContain(">=");
  });

  it("invalidates revealed paths when refreshed storage roots change", async () => {
    await act(async () => {
      root.render(<DiskUsageSection info={info} />);
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("button[title='Reveal full path']")
        ?.click();
    });
    expect(container.textContent).toContain("C:\\Videos\\Hinekora Recordings");

    await act(async () => {
      root.render(
        <DiskUsageSection
          info={{
            ...info,
            calculatedAt: "2026-07-23T01:00:00.000Z",
            storagePath: "D:\\**\\Hinekora Recordings",
          }}
        />,
      );
    });
    expect(container.textContent).toContain("D:\\**\\Hinekora Recordings");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("button[title='Reveal full path']")
        ?.click();
    });
    expect(revealPaths).toHaveBeenCalledTimes(2);
  });
});
