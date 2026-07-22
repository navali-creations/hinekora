import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageInfo } from "~/main/modules/storage/Storage.dto";

import DiskUsageSection from "./DiskUsageSection";

const info: StorageInfo = {
  appInstallationDiskFreeBytes: 500,
  appInstallationDiskTotalBytes: 1_000,
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
  databaseDiskFreeBytes: 500,
  databaseDiskTotalBytes: 1_000,
  databaseSizeBytes: 10,
  diskFreeBytes: 500,
  diskTotalBytes: 1_000,
  exportDiskFreeBytes: 500,
  exportDiskTotalBytes: 1_000,
  exportsPath: "C:\\**\\Hinekora Exports",
  exportVideosSizeBytes: 100,
  mediaSizeBytes: 300,
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
    exportsPath: "C:\\Videos\\Hinekora Exports",
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
            exportDiskFreeBytes: 1_500,
            exportDiskTotalBytes: 2_000,
          }}
        />,
      );
    });

    expect(
      container.querySelectorAll("button[title='Reveal full path']"),
    ).toHaveLength(2);
    expect(container.textContent).toContain("C:\\**\\Hinekora Exports");
  });
});
