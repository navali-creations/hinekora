import type {
  AuraAddRequest,
  CropRegionSelectionShape,
} from "~/main/modules/overlay-windows/OverlayWindows.dto";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import type { Profile } from "~/types";
import type { AuraHistorySnapshot } from "../AuraOverlay.page/AuraOverlay.page.utils.types";
import { createAuraHistorySnapshot } from "../AuraOverlay.page/createAuraHistorySnapshot/createAuraHistorySnapshot";

const auraHistoryLimit = 50;

interface AuraOverlayHistoryState {
  profileId: string | null;
  redo: AuraHistorySnapshot[];
  revision: number;
  undo: AuraHistorySnapshot[];
}

interface AuraOverlayAreaSelection {
  height: number;
  placementIds: string[];
  width: number;
  x: number;
  y: number;
}

interface AuraHistoryTransition {
  historyBeforeTransition: AuraOverlayHistoryState;
  revision: number;
  selectedPlacementIdAfterTransition: string | null;
  selectedPlacementIdBeforeTransition: string | null;
  snapshot: AuraHistorySnapshot;
}

interface AuraOverlaySlice {
  auraOverlay: {
    addAuraRequest: AuraAddRequest | null;
    addAuraSelectionError: string | null;
    addingAuraShape: CropRegionSelectionShape | null;
    areaSelection: AuraOverlayAreaSelection | null;
    editingHistory: AuraOverlayHistoryState;
    selectedPlacementId: string | null;
    clearAreaSelection: () => void;
    clearPlacementSelection: () => void;
    moveAreaSelection: (deltaX: number, deltaY: number) => void;
    recordAuraHistory: (profile: Profile) => void;
    redoAuraHistory: (profile: Profile) => AuraHistoryTransition | null;
    resetAuraHistory: (profileId: string | null) => void;
    rollbackAuraHistory: (transition: AuraHistoryTransition) => void;
    selectPlacement: (placementId: string) => void;
    setAddAuraRequest: (request: AuraAddRequest | null) => void;
    setAddAuraSelectionError: (error: string | null) => void;
    setAddingAuraShape: (shape: CropRegionSelectionShape | null) => void;
    setAreaSelection: (selection: AuraOverlayAreaSelection | null) => void;
    undoAuraHistory: (profile: Profile) => AuraHistoryTransition | null;
  };
}

function appendHistorySnapshot(
  snapshots: AuraHistorySnapshot[],
  snapshot: AuraHistorySnapshot,
): void {
  snapshots.push(snapshot);
  if (snapshots.length > auraHistoryLimit) {
    snapshots.shift();
  }
}

function copyAuraHistoryState(
  history: AuraOverlayHistoryState,
): AuraOverlayHistoryState {
  return {
    profileId: history.profileId,
    redo: [...history.redo],
    revision: history.revision,
    undo: [...history.undo],
  };
}

function resolveHistorySelection(
  snapshot: AuraHistorySnapshot,
  selectedPlacementId: string | null,
): string | null {
  if (
    selectedPlacementId &&
    snapshot.overlayPlacements.some(
      (placement) => placement.id === selectedPlacementId,
    )
  ) {
    return selectedPlacementId;
  }

  return snapshot.overlayPlacements[0]?.id ?? null;
}

function createAuraHistoryTransition(
  history: AuraOverlayHistoryState,
  storedSnapshot: AuraHistorySnapshot,
  selectedPlacementId: string | null,
): AuraHistoryTransition {
  const snapshot = createAuraHistorySnapshot(storedSnapshot);

  return {
    historyBeforeTransition: copyAuraHistoryState(history),
    revision: history.revision + 1,
    selectedPlacementIdAfterTransition: resolveHistorySelection(
      snapshot,
      selectedPlacementId,
    ),
    selectedPlacementIdBeforeTransition: selectedPlacementId,
    snapshot,
  };
}

const createAuraOverlaySlice: BoundStoreStateCreator<AuraOverlaySlice> = (
  set,
  get,
) => ({
  auraOverlay: {
    addAuraRequest: null,
    addAuraSelectionError: null,
    addingAuraShape: null,
    areaSelection: null,
    editingHistory: {
      profileId: null,
      redo: [],
      revision: 0,
      undo: [],
    },
    selectedPlacementId: null,
    clearAreaSelection: () => {
      set((state) => {
        state.auraOverlay.areaSelection = null;
      });
    },
    clearPlacementSelection: () => {
      set((state) => {
        state.auraOverlay.selectedPlacementId = null;
      });
    },
    moveAreaSelection: (deltaX, deltaY) => {
      set((state) => {
        const selection = state.auraOverlay.areaSelection;
        if (selection) {
          selection.x += deltaX;
          selection.y += deltaY;
        }
      });
    },
    recordAuraHistory: (profile) => {
      set((state) => {
        const history = state.auraOverlay.editingHistory;
        if (history.profileId !== profile.id) {
          history.profileId = profile.id;
          history.redo = [];
          history.undo = [];
        }

        appendHistorySnapshot(history.undo, createAuraHistorySnapshot(profile));
        history.redo = [];
        history.revision += 1;
      });
    },
    redoAuraHistory: (profile) => {
      const currentHistory = get().auraOverlay.editingHistory;
      const storedSnapshot = currentHistory.redo.at(-1);
      if (currentHistory.profileId !== profile.id || !storedSnapshot) {
        return null;
      }
      const transition = createAuraHistoryTransition(
        currentHistory,
        storedSnapshot,
        get().auraOverlay.selectedPlacementId,
      );

      set((state) => {
        const history = state.auraOverlay.editingHistory;
        history.redo.pop();
        appendHistorySnapshot(history.undo, createAuraHistorySnapshot(profile));
        history.revision = transition.revision;
      });
      return transition;
    },
    resetAuraHistory: (profileId) => {
      set((state) => {
        const revision = state.auraOverlay.editingHistory.revision + 1;
        state.auraOverlay.editingHistory = {
          profileId,
          redo: [],
          revision,
          undo: [],
        };
        state.auraOverlay.areaSelection = null;
        state.auraOverlay.selectedPlacementId = null;
      });
    },
    rollbackAuraHistory: (transition) => {
      set((state) => {
        const history = state.auraOverlay.editingHistory;
        if (
          history.profileId !== transition.historyBeforeTransition.profileId ||
          history.revision !== transition.revision
        ) {
          return;
        }

        state.auraOverlay.editingHistory = {
          ...copyAuraHistoryState(transition.historyBeforeTransition),
          revision: history.revision + 1,
        };
        if (
          state.auraOverlay.selectedPlacementId ===
          transition.selectedPlacementIdAfterTransition
        ) {
          state.auraOverlay.selectedPlacementId =
            transition.selectedPlacementIdBeforeTransition;
        }
      });
    },
    selectPlacement: (placementId) => {
      set((state) => {
        state.auraOverlay.areaSelection = null;
        state.auraOverlay.selectedPlacementId = placementId;
      });
    },
    setAddAuraRequest: (request) => {
      set((state) => {
        state.auraOverlay.addAuraRequest = request;
      });
    },
    setAddAuraSelectionError: (error) => {
      set((state) => {
        state.auraOverlay.addAuraSelectionError = error;
      });
    },
    setAddingAuraShape: (shape) => {
      set((state) => {
        state.auraOverlay.addingAuraShape = shape;
      });
    },
    setAreaSelection: (selection) => {
      set((state) => {
        state.auraOverlay.areaSelection = selection;
        if (selection) {
          state.auraOverlay.selectedPlacementId = null;
        }
      });
    },
    undoAuraHistory: (profile) => {
      const currentHistory = get().auraOverlay.editingHistory;
      const storedSnapshot = currentHistory.undo.at(-1);
      if (currentHistory.profileId !== profile.id || !storedSnapshot) {
        return null;
      }
      const transition = createAuraHistoryTransition(
        currentHistory,
        storedSnapshot,
        get().auraOverlay.selectedPlacementId,
      );

      set((state) => {
        const history = state.auraOverlay.editingHistory;
        history.undo.pop();
        appendHistorySnapshot(history.redo, createAuraHistorySnapshot(profile));
        history.revision = transition.revision;
      });
      return transition;
    },
  },
});

export type {
  AuraHistoryTransition,
  AuraOverlayAreaSelection,
  AuraOverlaySlice,
};
export { createAuraOverlaySlice };
