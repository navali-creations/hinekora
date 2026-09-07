import { describe, expect, it } from "vitest";

import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import type { Profile } from "~/types";
import { createAuraOverlaySlice } from "./AuraOverlay.slice";

function createProfile(x = 10): Profile {
  return {
    captureTarget: null,
    createdAt: new Date(0).toISOString(),
    cropRegions: [
      { id: "crop-1", label: "Aura 1", x: 0, y: 0, width: 40, height: 40 },
    ],
    game: "poe1",
    id: "profile-1",
    name: "Default",
    overlayPlacements: [
      {
        cropRegionId: "crop-1",
        id: "placement-1",
        opacity: 1,
        scale: 1,
        x,
        y: 10,
      },
    ],
    targetFps: 30,
    updatedAt: new Date(0).toISOString(),
  };
}

describe("AuraOverlay slice", () => {
  it("tracks pending add-aura requests and the active selection shape", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );

    expect(store.getState().auraOverlay.addAuraRequest).toBeNull();
    expect(store.getState().auraOverlay.addAuraSelectionError).toBeNull();
    expect(store.getState().auraOverlay.addingAuraShape).toBeNull();
    expect(store.getState().auraOverlay.areaSelection).toBeNull();
    expect(store.getState().auraOverlay.selectedPlacementId).toBeNull();

    store
      .getState()
      .auraOverlay.setAddAuraRequest({ requestId: "request-1", shape: "arc" });
    store
      .getState()
      .auraOverlay.setAddAuraSelectionError("Selection unavailable");
    store.getState().auraOverlay.setAddingAuraShape("points");

    expect(store.getState().auraOverlay.addAuraRequest).toEqual({
      requestId: "request-1",
      shape: "arc",
    });
    expect(store.getState().auraOverlay.addingAuraShape).toBe("points");
    expect(store.getState().auraOverlay.addAuraSelectionError).toBe(
      "Selection unavailable",
    );

    store.getState().auraOverlay.setAddAuraRequest(null);
    store.getState().auraOverlay.setAddAuraSelectionError(null);
    store.getState().auraOverlay.setAddingAuraShape(null);

    expect(store.getState().auraOverlay.addAuraRequest).toBeNull();
    expect(store.getState().auraOverlay.addAuraSelectionError).toBeNull();
    expect(store.getState().auraOverlay.addingAuraShape).toBeNull();
  });

  it("owns completed area selection and clears it when an aura gains focus", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );
    const selection = {
      height: 80,
      placementIds: ["placement-1", "placement-2"],
      width: 120,
      x: 20,
      y: 30,
    };

    store.getState().auraOverlay.selectPlacement("placement-1");
    store.getState().auraOverlay.setAreaSelection(selection);
    expect(store.getState().auraOverlay.areaSelection).toEqual(selection);
    expect(store.getState().auraOverlay.selectedPlacementId).toBeNull();

    store.getState().auraOverlay.moveAreaSelection(15, -5);
    expect(store.getState().auraOverlay.areaSelection).toEqual({
      ...selection,
      x: 35,
      y: 25,
    });

    store.getState().auraOverlay.selectPlacement("placement-2");
    expect(store.getState().auraOverlay.areaSelection).toBeNull();
    expect(store.getState().auraOverlay.selectedPlacementId).toBe(
      "placement-2",
    );

    store.getState().auraOverlay.setAreaSelection(selection);
    store.getState().auraOverlay.clearAreaSelection();
    expect(store.getState().auraOverlay.areaSelection).toBeNull();
  });

  it("owns the selected aura placement", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );

    store.getState().auraOverlay.selectPlacement("placement-1");
    expect(store.getState().auraOverlay.selectedPlacementId).toBe(
      "placement-1",
    );

    store.getState().auraOverlay.clearPlacementSelection();
    expect(store.getState().auraOverlay.selectedPlacementId).toBeNull();
  });

  it("records, undoes, and redoes aura history for the active profile", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );
    const profile = createProfile();

    store.getState().auraOverlay.recordAuraHistory(profile);
    const resizedProfile = {
      ...profile,
      overlayPlacements: profile.overlayPlacements.map((placement) => ({
        ...placement,
        height: 80,
        width: 80,
      })),
    };
    expect(
      store.getState().auraOverlay.undoAuraHistory(resizedProfile)?.snapshot,
    ).toEqual({
      cropRegions: profile.cropRegions,
      overlayPlacements: profile.overlayPlacements,
    });
    expect(
      store.getState().auraOverlay.redoAuraHistory(profile)?.snapshot,
    ).toEqual({
      cropRegions: resizedProfile.cropRegions,
      overlayPlacements: resizedProfile.overlayPlacements,
    });
  });

  it("resets history and ignores snapshots from another profile", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );
    const profile = {
      captureTarget: null,
      createdAt: new Date(0).toISOString(),
      cropRegions: [],
      game: "poe1" as const,
      id: "profile-1",
      name: "Default",
      overlayPlacements: [],
      targetFps: 30,
      updatedAt: new Date(0).toISOString(),
    };

    store.getState().auraOverlay.recordAuraHistory(profile);
    store.getState().auraOverlay.selectPlacement("placement-1");
    store.getState().auraOverlay.resetAuraHistory("profile-2");

    expect(store.getState().auraOverlay.selectedPlacementId).toBeNull();
    expect(store.getState().auraOverlay.editingHistory).toEqual({
      profileId: "profile-2",
      redo: [],
      revision: 2,
      undo: [],
    });
    expect(store.getState().auraOverlay.undoAuraHistory(profile)).toBeNull();
    expect(store.getState().auraOverlay.redoAuraHistory(profile)).toBeNull();
  });

  it("rolls back failed undo and redo transitions", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );
    const profile = createProfile();
    const resizedProfile = createProfile(20);
    store.getState().auraOverlay.selectPlacement("placement-before");
    store.getState().auraOverlay.recordAuraHistory(profile);

    const failedUndo = store
      .getState()
      .auraOverlay.undoAuraHistory(resizedProfile);
    expect(failedUndo?.snapshot.overlayPlacements[0]?.x).toBe(10);
    if (!failedUndo) {
      throw new Error("Expected an undo transition");
    }
    expect(failedUndo.selectedPlacementIdBeforeTransition).toBe(
      "placement-before",
    );
    expect(failedUndo.selectedPlacementIdAfterTransition).toBe("placement-1");
    store
      .getState()
      .auraOverlay.selectPlacement(
        failedUndo.selectedPlacementIdAfterTransition!,
      );
    store.getState().auraOverlay.rollbackAuraHistory(failedUndo);
    expect(store.getState().auraOverlay.selectedPlacementId).toBe(
      "placement-before",
    );

    const retriedUndo = store
      .getState()
      .auraOverlay.undoAuraHistory(resizedProfile);
    expect(retriedUndo?.snapshot.overlayPlacements[0]?.x).toBe(10);
    const failedRedo = store.getState().auraOverlay.redoAuraHistory(profile);
    expect(failedRedo?.snapshot.overlayPlacements[0]?.x).toBe(20);
    if (!failedRedo) {
      throw new Error("Expected a redo transition");
    }
    store.getState().auraOverlay.rollbackAuraHistory(failedRedo);

    expect(
      store.getState().auraOverlay.redoAuraHistory(profile)?.snapshot
        .overlayPlacements[0]?.x,
    ).toBe(20);
  });

  it("keeps only the latest 50 history snapshots", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );

    for (let index = 0; index <= 50; index += 1) {
      store.getState().auraOverlay.recordAuraHistory(createProfile(index));
    }

    const history = store.getState().auraOverlay.editingHistory.undo;
    expect(history).toHaveLength(50);
    expect(history[0]?.overlayPlacements[0]?.x).toBe(1);
    expect(history.at(-1)?.overlayPlacements[0]?.x).toBe(50);
  });

  it("does not roll back over a newer history change", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );
    const profile = createProfile();
    store.getState().auraOverlay.recordAuraHistory(profile);
    const staleTransition = store
      .getState()
      .auraOverlay.undoAuraHistory(createProfile(20));
    if (!staleTransition) {
      throw new Error("Expected an undo transition");
    }

    store.getState().auraOverlay.recordAuraHistory(createProfile(30));
    store.getState().auraOverlay.rollbackAuraHistory(staleTransition);

    expect(
      store.getState().auraOverlay.editingHistory.undo.at(-1)
        ?.overlayPlacements[0]?.x,
    ).toBe(30);
  });

  it("does not restore stale focus when selection changes during rollback", () => {
    const store = createBoundStoreForTests((set, get, api) =>
      createAuraOverlaySlice(set, get, api),
    );
    const profile = createProfile();
    store.getState().auraOverlay.selectPlacement("placement-before");
    store.getState().auraOverlay.recordAuraHistory(profile);
    const transition = store
      .getState()
      .auraOverlay.undoAuraHistory(createProfile(20));
    if (!transition) {
      throw new Error("Expected an undo transition");
    }

    store
      .getState()
      .auraOverlay.selectPlacement(
        transition.selectedPlacementIdAfterTransition!,
      );
    store.getState().auraOverlay.selectPlacement("placement-newer");
    store.getState().auraOverlay.rollbackAuraHistory(transition);

    expect(store.getState().auraOverlay.selectedPlacementId).toBe(
      "placement-newer",
    );
    expect(store.getState().auraOverlay.editingHistory.undo).toHaveLength(1);
  });
});
