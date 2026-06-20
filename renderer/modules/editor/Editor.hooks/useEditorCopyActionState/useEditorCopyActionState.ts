import { useCallback, useEffect, useRef, useState } from "react";

import type { EditorExportFileActionResult } from "~/main/modules/editor";

type EditorCopyActionState = "copied" | "copying" | "failed" | "idle";

interface RunEditorCopyActionOptions {
  onCrash?: (error: unknown) => void;
  onFailure?: (error: string | null) => void;
}

function useEditorCopyActionState() {
  const [copyState, setCopyState] = useState<EditorCopyActionState>("idle");
  const resetCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const resetCopyStateLater = useCallback(() => {
    if (resetCopyTimeoutRef.current) {
      clearTimeout(resetCopyTimeoutRef.current);
    }

    resetCopyTimeoutRef.current = setTimeout(() => {
      setCopyState("idle");
      resetCopyTimeoutRef.current = null;
    }, 1_800);
  }, []);

  const runCopyAction = useCallback(
    (
      copyAction: () => Promise<EditorExportFileActionResult>,
      options: RunEditorCopyActionOptions = {},
    ) => {
      if (copyState === "copying") {
        return;
      }

      setCopyState("copying");
      void copyAction()
        .then((result) => {
          if (!result.ok) {
            options.onFailure?.(result.error);
          }

          setCopyState(result.ok ? "copied" : "failed");
          resetCopyStateLater();
        })
        .catch((error) => {
          options.onCrash?.(error);
          setCopyState("failed");
          resetCopyStateLater();
        });
    },
    [copyState, resetCopyStateLater],
  );

  useEffect(
    () => () => {
      if (resetCopyTimeoutRef.current) {
        clearTimeout(resetCopyTimeoutRef.current);
      }
    },
    [],
  );

  return {
    copyState,
    isCopied: copyState === "copied",
    isCopying: copyState === "copying",
    runCopyAction,
  };
}

export type { EditorCopyActionState };
export { useEditorCopyActionState };
