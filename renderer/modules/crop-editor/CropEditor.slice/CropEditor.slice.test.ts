import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createCropEditorSlice } from "./CropEditor.slice";

function createTestStore() {
  return createBoundStoreForTests(
    (set, get, api) =>
      createCropEditorSlice(set, get, api) as unknown as BoundStore,
  );
}

describe("CropEditor slice", () => {
  const unsubscribe = vi.fn();
  const isAuraLocked = vi.fn();
  let auraLockChangedListener: ((locked: boolean) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    auraLockChangedListener = null;
    isAuraLocked.mockResolvedValue(false);

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        overlayWindows: {
          isAuraLocked,
          onAuraLockChanged: vi.fn((listener: (locked: boolean) => void) => {
            auraLockChangedListener = listener;
            return unsubscribe;
          }),
        },
      },
    });
  });

  it("hydrates and listens to aura overlay lock state", async () => {
    const store = createTestStore();

    await store.getState().cropEditor.hydrate();

    expect(store.getState().cropEditor.auraOverlayLocked).toBe(false);

    const stopListening = store.getState().cropEditor.startListening();
    auraLockChangedListener?.(true);

    expect(store.getState().cropEditor.auraOverlayLocked).toBe(true);

    stopListening();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("updates lock and aura selection locally", () => {
    const store = createTestStore();

    store.getState().cropEditor.setAuraOverlayLocked(false);
    store.getState().cropEditor.selectAura("crop-1");
    store.getState().cropEditor.selectAura(null);

    expect(store.getState().cropEditor.auraOverlayLocked).toBe(false);
    expect(store.getState().cropEditor.selectedAuraCropRegionId).toBeNull();
  });
});
