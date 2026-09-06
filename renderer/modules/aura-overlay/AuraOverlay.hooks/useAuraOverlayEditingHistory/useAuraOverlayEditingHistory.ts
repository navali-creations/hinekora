import { useCallback, useEffect, useRef } from "react";

import { isKeyboardShortcutEditableTarget } from "~/renderer/modules/keyboard-shortcuts/KeyboardShortcuts.utils/KeyboardShortcuts.utils";
import { useAuraOverlayShallow, useProfilesShallow } from "~/renderer/store";

import type { Profile } from "~/types";
import {
  type AuraHistorySnapshot,
  createAuraProfileUpdateDeletingPlacement,
  createAuraProfileUpdateFromSnapshot,
} from "../../AuraOverlay.page/AuraOverlay.page.utils";
import type { AuraHistoryTransition } from "../../AuraOverlay.slice/AuraOverlay.slice";

interface UseAuraOverlayEditingHistoryInput {
  canEditAuras: boolean;
  profile: Profile | null;
}

export function useAuraOverlayEditingHistory({
  canEditAuras,
  profile,
}: UseAuraOverlayEditingHistoryInput): void {
  const historyUpdatePendingRef = useRef(false);
  const updateProfile = useProfilesShallow((profiles) => profiles.update);
  const {
    clearPlacementSelection,
    recordHistory,
    redoHistory,
    resetHistory,
    rollbackHistory,
    selectPlacement,
    selectedPlacementId,
    undoHistory,
  } = useAuraOverlayShallow((auraOverlay) => ({
    clearPlacementSelection: auraOverlay.clearPlacementSelection,
    recordHistory: auraOverlay.recordAuraHistory,
    redoHistory: auraOverlay.redoAuraHistory,
    resetHistory: auraOverlay.resetAuraHistory,
    rollbackHistory: auraOverlay.rollbackAuraHistory,
    selectPlacement: auraOverlay.selectPlacement,
    selectedPlacementId: auraOverlay.selectedPlacementId,
    undoHistory: auraOverlay.undoAuraHistory,
  }));

  useEffect(() => {
    resetHistory(profile?.id ?? null);
  }, [profile?.id, resetHistory]);

  useEffect(() => {
    if (!profile) {
      clearPlacementSelection();
      return;
    }

    if (
      selectedPlacementId &&
      !profile.overlayPlacements.some(
        (placement) => placement.id === selectedPlacementId,
      )
    ) {
      clearPlacementSelection();
    }
  }, [clearPlacementSelection, profile, selectedPlacementId]);

  const applyHistorySnapshot = useCallback(
    async (
      snapshot: AuraHistorySnapshot,
      selectedPlacementId: string | null,
    ) => {
      if (!profile) {
        return;
      }

      if (selectedPlacementId) {
        selectPlacement(selectedPlacementId);
      } else {
        clearPlacementSelection();
      }
      await updateProfile(
        createAuraProfileUpdateFromSnapshot(profile.id, snapshot),
      );
    },
    [clearPlacementSelection, profile, selectPlacement, updateProfile],
  );

  const applyHistoryTransition = useCallback(
    (transition: AuraHistoryTransition) => {
      if (!profile) {
        return;
      }

      historyUpdatePendingRef.current = true;
      void applyHistorySnapshot(
        transition.snapshot,
        transition.selectedPlacementIdAfterTransition,
      )
        .catch(() => {
          rollbackHistory(transition);
        })
        .finally(() => {
          historyUpdatePendingRef.current = false;
        });
    },
    [applyHistorySnapshot, profile, rollbackHistory],
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

    recordHistory(profile);
    const firstPlacementId = profileUpdate.overlayPlacements?.[0]?.id;
    if (firstPlacementId) {
      selectPlacement(firstPlacementId);
    } else {
      clearPlacementSelection();
    }
    void updateProfile(profileUpdate).catch(() => undefined);
  }, [
    canEditAuras,
    clearPlacementSelection,
    profile,
    recordHistory,
    selectPlacement,
    selectedPlacementId,
    updateProfile,
  ]);

  const undoAuraHistory = useCallback(() => {
    if (!canEditAuras || !profile || historyUpdatePendingRef.current) {
      return;
    }

    const transition = undoHistory(profile);
    if (!transition) {
      return;
    }

    applyHistoryTransition(transition);
  }, [applyHistoryTransition, canEditAuras, profile, undoHistory]);

  const redoAuraHistory = useCallback(() => {
    if (!canEditAuras || !profile || historyUpdatePendingRef.current) {
      return;
    }

    const transition = redoHistory(profile);
    if (!transition) {
      return;
    }

    applyHistoryTransition(transition);
  }, [applyHistoryTransition, canEditAuras, profile, redoHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        isKeyboardShortcutEditableTarget(event.target)
      ) {
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
}
