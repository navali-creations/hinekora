import { useCallback, useState } from "react";

import type { RunRecordingDetail } from "~/main/modules/recording-storage";

interface FileActionMessage {
  text: string;
  tone: "error" | "success";
}

interface UseRecordingDetailFileActionsOptions {
  onDeleted?: () => void;
}

function useRecordingDetailFileActions(
  recording: RunRecordingDetail["recording"] | null,
  { onDeleted }: UseRecordingDetailFileActionsOptions = {},
) {
  const [fileActionMessage, setFileActionMessage] =
    useState<FileActionMessage | null>(null);

  const resetFileActions = useCallback(() => {
    setFileActionMessage(null);
  }, []);

  const handleOpenLocation = useCallback(() => {
    if (!recording) {
      return;
    }

    setFileActionMessage(null);
    void window.electron.recordingStorage
      .revealRecording(recording.path)
      .then((result) => {
        if (!result.ok) {
          setFileActionMessage({
            text: result.error ?? "Could not open recording location.",
            tone: "error",
          });
        }
      })
      .catch((error: unknown) => {
        setFileActionMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not open recording location.",
          tone: "error",
        });
      });
  }, [recording]);

  const handleDeleteRecording = useCallback(() => {
    if (!recording) {
      return;
    }

    setFileActionMessage(null);
    void window.electron.recordingStorage
      .deleteRecording(recording.path)
      .then((result) => {
        if (result.ok) {
          onDeleted?.();
          return;
        }

        setFileActionMessage({
          text: result.error ?? "Could not delete recording.",
          tone: "error",
        });
      })
      .catch((error: unknown) => {
        setFileActionMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not delete recording.",
          tone: "error",
        });
      });
  }, [onDeleted, recording]);

  return {
    fileActionMessage,
    handleDeleteRecording,
    handleOpenLocation,
    resetFileActions,
  };
}

export { type FileActionMessage, useRecordingDetailFileActions };
