import { useCallback, useRef } from "react";

interface ClipPreviewOperationResult {
  error?: string | null;
  ok: boolean;
}

interface RunClipPreviewOperationInput<T extends ClipPreviewOperationResult> {
  execute: (requestId: string) => Promise<T>;
  fallbackError: string;
  getResultError?: (result: T) => string | null;
  onSettled?: () => void;
  onSuccess: (result: T) => void;
}

function useClipPreviewOverlayOperation(input: {
  setActive: (active: boolean) => void;
  setOperationProgress: (progress: number) => void;
  setSaveMessage: (
    message: { text: string; tone: "error" | "success" } | null,
  ) => void;
}) {
  const operationRequestRef = useRef<string | null>(null);

  const runOperation = useCallback(
    <T extends ClipPreviewOperationResult>(
      operation: RunClipPreviewOperationInput<T>,
    ) => {
      if (operationRequestRef.current !== null) {
        return;
      }

      input.setActive(true);
      input.setOperationProgress(0.02);
      input.setSaveMessage(null);
      const requestId = globalThis.crypto.randomUUID();
      operationRequestRef.current = requestId;
      const unsubscribeProgress =
        window.electron.replayClips.onOperationProgress(
          ({ operationRequestId, progress }) => {
            if (operationRequestId === requestId) {
              input.setOperationProgress(Math.min(Math.max(progress, 0), 0.98));
            }
          },
        );

      void operation
        .execute(requestId)
        .then((result) => {
          if (operationRequestRef.current !== requestId) {
            return;
          }
          const resultError = operation.getResultError
            ? operation.getResultError(result)
            : result.ok
              ? null
              : (result.error ?? operation.fallbackError);
          if (resultError) {
            input.setSaveMessage({ text: resultError, tone: "error" });
            return;
          }

          operation.onSuccess(result);
        })
        .catch((error: unknown) => {
          if (operationRequestRef.current === requestId) {
            input.setSaveMessage({
              text:
                error instanceof Error
                  ? error.message
                  : operation.fallbackError,
              tone: "error",
            });
          }
        })
        .finally(() => {
          unsubscribeProgress();
          if (operationRequestRef.current === requestId) {
            try {
              operation.onSettled?.();
            } finally {
              operationRequestRef.current = null;
              input.setActive(false);
            }
          }
        });
    },
    [input.setActive, input.setOperationProgress, input.setSaveMessage],
  );

  return { runOperation };
}

export { useClipPreviewOverlayOperation };
