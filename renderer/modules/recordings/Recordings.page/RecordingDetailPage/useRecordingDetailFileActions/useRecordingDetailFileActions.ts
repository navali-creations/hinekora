import { useCallback, useEffect, useRef, useState } from "react";

import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import type { MediaDetailCopyState } from "~/renderer/modules/media-library/MediaLibrary.components/MediaDetailPageActions/MediaDetailPageActions";

interface FileActionMessage {
  text: string;
  tone: "error" | "success";
}

function useRecordingDetailFileActions(
  recording: RunRecordingDetail["recording"] | null,
) {
  const [copyState, setCopyState] = useState<MediaDetailCopyState>("idle");
  const [fileActionMessage, setFileActionMessage] =
    useState<FileActionMessage | null>(null);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    },
    [],
  );

  const resetFileActions = useCallback(() => {
    setCopyState("idle");
    setFileActionMessage(null);
  }, []);

  const resetCopiedStateLater = useCallback(() => {
    if (copyResetTimeoutRef.current) {
      clearTimeout(copyResetTimeoutRef.current);
    }

    copyResetTimeoutRef.current = setTimeout(() => {
      setCopyState("idle");
      copyResetTimeoutRef.current = null;
    }, 1_800);
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

  const handleCopyToClipboard = useCallback(() => {
    if (!recording) {
      return;
    }

    setCopyState("copying");
    setFileActionMessage(null);
    void window.electron.recordingStorage
      .copyRecording(recording.path)
      .then((result) => {
        if (result.ok) {
          setCopyState("copied");
          setFileActionMessage({
            text: "Video copied to clipboard.",
            tone: "success",
          });
          resetCopiedStateLater();
          return;
        }

        setCopyState("idle");
        setFileActionMessage({
          text: result.error ?? "Could not copy recording to clipboard.",
          tone: "error",
        });
      })
      .catch((error: unknown) => {
        setCopyState("idle");
        setFileActionMessage({
          text:
            error instanceof Error
              ? error.message
              : "Could not copy recording to clipboard.",
          tone: "error",
        });
      });
  }, [recording, resetCopiedStateLater]);

  return {
    copyState,
    fileActionMessage,
    handleCopyToClipboard,
    handleOpenLocation,
    resetFileActions,
  };
}

export { type FileActionMessage, useRecordingDetailFileActions };
