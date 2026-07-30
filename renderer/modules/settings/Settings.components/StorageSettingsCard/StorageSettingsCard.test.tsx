import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  analysisAvailability: "ready" as "deferred" | "ready" | null,
  error: null as string | null,
  isLoading: false,
  refreshStorage: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useStorageShallow: (
    selector: (storage: {
      analysisAvailability: "deferred" | "ready" | null;
      deleteGameLeagueData: ReturnType<typeof vi.fn>;
      deletingGameLeagueId: null;
      error: string | null;
      gameLeagueUsage: [];
      info: null;
      isLoading: boolean;
      refresh: ReturnType<typeof vi.fn>;
    }) => unknown,
  ) =>
    selector({
      analysisAvailability: storeMocks.analysisAvailability,
      deleteGameLeagueData: vi.fn(),
      deletingGameLeagueId: null,
      error: storeMocks.error,
      gameLeagueUsage: [],
      info: null,
      isLoading: storeMocks.isLoading,
      refresh: storeMocks.refreshStorage,
    }),
}));

vi.mock(
  "./RecordingStorageSettingsFields/RecordingStorageSettingsFields",
  () => ({
    RecordingStorageSettingsFields: () => null,
  }),
);
vi.mock("../storage/DeleteLeagueModal/DeleteLeagueModal", () => ({
  default: () => null,
}));
vi.mock("../storage/DiskUsageSection/DiskUsageSection", () => ({
  default: () => null,
}));
vi.mock("../storage/LeagueDataSection/LeagueDataSection", () => ({
  default: () => null,
}));

import { StorageSettingsCard } from "./StorageSettingsCard";

let container: HTMLDivElement;
let root: Root;

async function renderCard(): Promise<void> {
  await act(async () => {
    root.render(<StorageSettingsCard />);
    await Promise.resolve();
  });
}

describe("StorageSettingsCard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.analysisAvailability = "ready";
    storeMocks.error = null;
    storeMocks.isLoading = false;
    storeMocks.refreshStorage.mockReset();
    storeMocks.refreshStorage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("shows authoritative deferred availability until analysis resumes", async () => {
    storeMocks.analysisAvailability = "deferred";

    await renderCard();

    expect(container.textContent).toContain("Storage analysis is paused");
    expect(container.textContent).not.toContain("Analyzing storage");
    expect(storeMocks.refreshStorage).toHaveBeenCalledOnce();

    storeMocks.analysisAvailability = "ready";
    await renderCard();

    expect(container.textContent).not.toContain("Storage analysis is paused");
    expect(storeMocks.refreshStorage).toHaveBeenCalledTimes(1);
  });

  it("shows progress while an allowed analysis is running", async () => {
    storeMocks.isLoading = true;

    await renderCard();

    expect(container.textContent).toContain("Analyzing storage");
    expect(container.textContent).not.toContain("Storage analysis is paused");
    expect(storeMocks.refreshStorage).toHaveBeenCalledTimes(1);
  });

  it("disables retry until analysis is ready", async () => {
    storeMocks.analysisAvailability = "deferred";
    storeMocks.error = "Storage failed";
    await renderCard();

    const retry = container.querySelector("button");
    expect(retry?.disabled).toBe(true);

    storeMocks.analysisAvailability = "ready";
    await renderCard();
    expect(retry?.disabled).toBe(false);

    await act(async () => {
      retry?.click();
      await Promise.resolve();
    });
    expect(storeMocks.refreshStorage).toHaveBeenCalledTimes(2);
  });
});
