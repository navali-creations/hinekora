import type { ReplayClipDetail } from "~/main/modules/replay-clips";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import type { ClipPreviewTrimRange } from "../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

interface ClipPreviewOverlaySaveMessage {
  text: string;
  tone: "error" | "success";
}

interface ClipPreviewOverlayState {
  detail: ReplayClipDetail | null;
  detailError: string | null;
  durationOverrideSeconds: number | null;
  isMediaReady: boolean;
  mediaError: string | null;
  isMuted: boolean;
  isPlaying: boolean;
  hasCopied: boolean;
  hasSavedClip: boolean;
  isCopying: boolean;
  isSaving: boolean;
  mediaVersion: number;
  operationProgress: number;
  previewProgress: number;
  saveMessage: ClipPreviewOverlaySaveMessage | null;
  titleDraft: string;
  trim: ClipPreviewTrimRange;
}

interface ClipPreviewOverlaySlice {
  clipPreviewOverlay: ClipPreviewOverlayState & {
    incrementMediaVersion: () => void;
    reset: () => void;
    resetLoadedClipState: (trim: ClipPreviewTrimRange) => void;
    setCopied: (hasCopied: boolean) => void;
    setHasSavedClip: (hasSavedClip: boolean) => void;
    setCopying: (isCopying: boolean) => void;
    setDetail: (detail: ReplayClipDetail | null) => void;
    setDetailError: (detailError: string | null) => void;
    setMediaReady: (isMediaReady: boolean) => void;
    setMediaError: (mediaError: string | null) => void;
    setMuted: (isMuted: boolean) => void;
    setPlaying: (isPlaying: boolean) => void;
    setDurationOverrideSeconds: (
      durationOverrideSeconds: number | null,
    ) => void;
    setOperationProgress: (operationProgress: number) => void;
    setPreviewProgress: (previewProgress: number) => void;
    setSaveMessage: (saveMessage: ClipPreviewOverlaySaveMessage | null) => void;
    setSaving: (isSaving: boolean) => void;
    setTitleDraft: (titleDraft: string) => void;
    setTrim: (trim: ClipPreviewTrimRange) => void;
  };
}

const initialTrimRange: ClipPreviewTrimRange = {
  inSeconds: 0,
  outSeconds: 0.1,
};

const createInitialClipPreviewOverlayState = (): ClipPreviewOverlayState => ({
  detail: null,
  detailError: null,
  durationOverrideSeconds: null,
  isMediaReady: false,
  mediaError: null,
  isMuted: false,
  isPlaying: false,
  hasCopied: false,
  hasSavedClip: false,
  isCopying: false,
  isSaving: false,
  mediaVersion: 0,
  operationProgress: 0,
  previewProgress: 0,
  saveMessage: null,
  titleDraft: "",
  trim: { ...initialTrimRange },
});

const createClipPreviewOverlaySlice: BoundStoreStateCreator<
  ClipPreviewOverlaySlice
> = (set) => ({
  clipPreviewOverlay: {
    ...createInitialClipPreviewOverlayState(),
    incrementMediaVersion: () => {
      set((state) => {
        state.clipPreviewOverlay.mediaVersion += 1;
      });
    },
    reset: () => {
      set((state) => {
        Object.assign(
          state.clipPreviewOverlay,
          createInitialClipPreviewOverlayState(),
        );
      });
    },
    resetLoadedClipState: (trim) => {
      set((state) => {
        state.clipPreviewOverlay.hasCopied = false;
        state.clipPreviewOverlay.operationProgress = 0;
        state.clipPreviewOverlay.previewProgress = 0;
        state.clipPreviewOverlay.saveMessage = null;
        state.clipPreviewOverlay.isMediaReady = false;
        state.clipPreviewOverlay.mediaError = null;
        state.clipPreviewOverlay.isMuted = false;
        state.clipPreviewOverlay.isPlaying = false;
        state.clipPreviewOverlay.titleDraft = "";
        state.clipPreviewOverlay.trim = trim;
      });
    },
    setCopied: (hasCopied) => {
      set((state) => {
        state.clipPreviewOverlay.hasCopied = hasCopied;
      });
    },
    setHasSavedClip: (hasSavedClip) => {
      set((state) => {
        state.clipPreviewOverlay.hasSavedClip = hasSavedClip;
      });
    },
    setCopying: (isCopying) => {
      set((state) => {
        state.clipPreviewOverlay.isCopying = isCopying;
      });
    },
    setDetail: (detail) => {
      set((state) => {
        state.clipPreviewOverlay.detail = detail;
      });
    },
    setDetailError: (detailError) => {
      set((state) => {
        state.clipPreviewOverlay.detailError = detailError;
      });
    },
    setMediaReady: (isMediaReady) => {
      set((state) => {
        state.clipPreviewOverlay.isMediaReady = isMediaReady;
      });
    },
    setMediaError: (mediaError) => {
      set((state) => {
        state.clipPreviewOverlay.mediaError = mediaError;
      });
    },
    setMuted: (isMuted) => {
      set((state) => {
        state.clipPreviewOverlay.isMuted = isMuted;
      });
    },
    setPlaying: (isPlaying) => {
      set((state) => {
        state.clipPreviewOverlay.isPlaying = isPlaying;
      });
    },
    setDurationOverrideSeconds: (durationOverrideSeconds) => {
      set((state) => {
        state.clipPreviewOverlay.durationOverrideSeconds =
          durationOverrideSeconds;
      });
    },
    setOperationProgress: (operationProgress) => {
      set((state) => {
        state.clipPreviewOverlay.operationProgress = Math.min(
          Math.max(operationProgress, 0),
          1,
        );
      });
    },
    setPreviewProgress: (previewProgress) => {
      set((state) => {
        state.clipPreviewOverlay.previewProgress = Math.min(
          Math.max(previewProgress, 0),
          1,
        );
      });
    },
    setSaveMessage: (saveMessage) => {
      set((state) => {
        state.clipPreviewOverlay.saveMessage = saveMessage;
      });
    },
    setSaving: (isSaving) => {
      set((state) => {
        state.clipPreviewOverlay.isSaving = isSaving;
      });
    },
    setTitleDraft: (titleDraft) => {
      set((state) => {
        state.clipPreviewOverlay.titleDraft = titleDraft;
      });
    },
    setTrim: (trim) => {
      set((state) => {
        state.clipPreviewOverlay.trim = trim;
      });
    },
  },
});

export type { ClipPreviewOverlaySlice };
export { createClipPreviewOverlaySlice };
