import { useCallback, useEffect, useRef, useState } from "react";

import type { ProfilesSlice } from "~/renderer/store/store.types";

import type { Profile } from "~/types";
import {
  type AuraHistorySnapshot,
  createAuraHistorySnapshot,
  createAuraProfileUpdateDeletingPlacement,
  createAuraProfileUpdateFromSnapshot,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";

const auraHistoryLimit = 50;

type UpdateProfile = ProfilesSlice["profiles"]["update"];

interface AuraHistoryState {
  profileId: string | null;
  redo: AuraHistorySnapshot[];
  undo: AuraHistorySnapshot[];
}

interface UseAuraOverlayEditingHistoryInput {
  canEditAuras: boolean;
  profile: Profile | null;
  updateProfile: UpdateProfile;
}

interface UseAuraOverlayEditingHistoryResult {
  recordAuraHistory: () => boolean;
  selectPlacement: (placementId: string) => void;
  selectedPlacementId: string | null;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
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

export function useAuraOverlayEditingHistory({
  canEditAuras,
  profile,
  updateProfile,
}: UseAuraOverlayEditingHistoryInput): UseAuraOverlayEditingHistoryResult {
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );
  const historyRef = useRef<AuraHistoryState>({
    profileId: null,
    redo: [],
    undo: [],
  });

  useEffect(() => {
    historyRef.current = {
      profileId: profile?.id ?? null,
      redo: [],
      undo: [],
    };
    setSelectedPlacementId(null);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) {
      setSelectedPlacementId(null);
      return;
    }

    setSelectedPlacementId((currentPlacementId) => {
      if (
        currentPlacementId &&
        profile.overlayPlacements.some(
          (placement) => placement.id === currentPlacementId,
        )
      ) {
        return currentPlacementId;
      }

      return null;
    });
  }, [profile]);

  const recordAuraHistory = useCallback(() => {
    if (!profile) {
      return false;
    }

    const history = historyRef.current;
    if (history.profileId !== profile.id) {
      history.profileId = profile.id;
      history.redo = [];
      history.undo = [];
    }

    appendHistorySnapshot(history.undo, createAuraHistorySnapshot(profile));
    history.redo = [];
    return true;
  }, [profile]);

  const applyHistorySnapshot = useCallback(
    (snapshot: AuraHistorySnapshot) => {
      if (!profile) {
        return;
      }

      setSelectedPlacementId(snapshot.overlayPlacements[0]?.id ?? null);
      void updateProfile(
        createAuraProfileUpdateFromSnapshot(profile.id, snapshot),
      );
    },
    [profile, updateProfile],
  );

  const deleteSelectedAura = useCallback(() => {
    if (!canEditAuras || !profile || !selectedPlacementId) {
      return;
    }

    const profileUpdate = createAuraProfileUpdateDeletingPlacement(
      profile,
      selectedPlacementId,
    );
    if (!profileUpdate) {
      return;
    }

    recordAuraHistory();
    setSelectedPlacementId(profileUpdate.overlayPlacements?.[0]?.id ?? null);
    void updateProfile(profileUpdate);
  }, [
    canEditAuras,
    profile,
    recordAuraHistory,
    selectedPlacementId,
    updateProfile,
  ]);

  const undoAuraHistory = useCallback(() => {
    if (!canEditAuras || !profile) {
      return;
    }

    const history = historyRef.current;
    if (history.profileId !== profile.id) {
      return;
    }

    const snapshot = history.undo.pop();
    if (!snapshot) {
      return;
    }

    appendHistorySnapshot(history.redo, createAuraHistorySnapshot(profile));
    applyHistorySnapshot(snapshot);
  }, [applyHistorySnapshot, canEditAuras, profile]);

  const redoAuraHistory = useCallback(() => {
    if (!canEditAuras || !profile) {
      return;
    }

    const history = historyRef.current;
    if (history.profileId !== profile.id) {
      return;
    }

    const snapshot = history.redo.pop();
    if (!snapshot) {
      return;
    }

    appendHistorySnapshot(history.undo, createAuraHistorySnapshot(profile));
    applyHistorySnapshot(snapshot);
  }, [applyHistorySnapshot, canEditAuras, profile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        void window.electron.overlayWindows.setAuraLocked(true);
        return;
      }

      if (!canEditAuras) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      const isUndoRedoChord = event.ctrlKey || event.metaKey;
      if (isUndoRedoChord && normalizedKey === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoAuraHistory();
          return;
        }

        undoAuraHistory();
        return;
      }

      if (isUndoRedoChord && normalizedKey === "y") {
        event.preventDefault();
        redoAuraHistory();
        return;
      }

      if (
        !event.repeat &&
        selectedPlacementId &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        deleteSelectedAura();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    canEditAuras,
    deleteSelectedAura,
    redoAuraHistory,
    selectedPlacementId,
    undoAuraHistory,
  ]);

  const selectPlacement = useCallback((placementId: string) => {
    setSelectedPlacementId(placementId);
  }, []);

  return {
    recordAuraHistory,
    selectPlacement,
    selectedPlacementId,
  };
}
