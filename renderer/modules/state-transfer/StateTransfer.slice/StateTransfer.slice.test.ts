import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { StateImportPreview } from "~/types";
import { createStateTransferSlice } from "./StateTransfer.slice";

const preview = {
  appVersion: "0.1.0",
  exportedAt: "2026-06-18T00:00:00.000Z",
  sections: {
    profiles: 1,
    replayClips: 2,
    settings: true,
  },
} as unknown as StateImportPreview;

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createStateTransferSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("StateTransfer slice", () => {
  const exportPortable = vi.fn();
  const importPortable = vi.fn();
  const previewImport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    exportPortable.mockResolvedValue({ ok: true, path: "C:\\backup.zip" });
    importPortable.mockResolvedValue({ ok: true });
    previewImport.mockResolvedValue(preview);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        stateTransfer: {
          exportPortable,
          importPortable,
          previewImport,
        },
      },
    });
  });

  it("exports, previews, and imports portable state", async () => {
    const store = createTestStore();

    await store.getState().stateTransfer.exportPortable();
    expect(store.getState().stateTransfer.lastMessage).toBe(
      "Exported to C:\\backup.zip",
    );

    await store.getState().stateTransfer.previewImport();
    expect(store.getState().stateTransfer.preview).toBe(preview);
    expect(store.getState().stateTransfer.lastMessage).toBe(
      "Import ready to apply",
    );

    await store.getState().stateTransfer.importPortable("merge");
    expect(importPortable).toHaveBeenCalledWith("merge");
    expect(store.getState().stateTransfer.lastMessage).toBe("Import applied");
  });

  it("stores fallback messages for canceled or failed transfers", async () => {
    const store = createTestStore();
    exportPortable.mockResolvedValueOnce({ ok: false });
    previewImport.mockResolvedValueOnce(null);
    importPortable.mockResolvedValueOnce({ ok: false });

    await store.getState().stateTransfer.exportPortable();
    await store.getState().stateTransfer.previewImport();
    await store.getState().stateTransfer.importPortable("replace");

    expect(store.getState().stateTransfer.preview).toBeNull();
    expect(store.getState().stateTransfer.lastMessage).toBe("Import failed");
  });
});
