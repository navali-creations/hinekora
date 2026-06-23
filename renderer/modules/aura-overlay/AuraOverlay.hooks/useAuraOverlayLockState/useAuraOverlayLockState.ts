import { useCallback, useEffect, useRef, useState } from "react";

const lockHandoffHintMs = 2_500;

interface ApplyAuraLockStateOptions {
  showHandoffHint?: boolean;
}

function useAuraOverlayLockState() {
  const [auraOverlayLocked, setAuraOverlayLocked] = useState(true);
  const [showLockHandoffHint, setShowLockHandoffHint] = useState(false);
  const lockStateRef = useRef<boolean | null>(null);
  const lockHandoffHintTimeoutRef = useRef<number | null>(null);

  const clearLockHandoffHint = useCallback(() => {
    if (lockHandoffHintTimeoutRef.current !== null) {
      window.clearTimeout(lockHandoffHintTimeoutRef.current);
      lockHandoffHintTimeoutRef.current = null;
    }
  }, []);

  const triggerLockHandoffHint = useCallback(() => {
    clearLockHandoffHint();
    setShowLockHandoffHint(true);
    lockHandoffHintTimeoutRef.current = window.setTimeout(() => {
      lockHandoffHintTimeoutRef.current = null;
      setShowLockHandoffHint(false);
    }, lockHandoffHintMs);
  }, [clearLockHandoffHint]);

  const applyAuraLockState = useCallback(
    (locked: boolean, options?: ApplyAuraLockStateOptions) => {
      const previousLocked = lockStateRef.current;
      lockStateRef.current = locked;
      setAuraOverlayLocked(locked);

      if (!locked) {
        clearLockHandoffHint();
        setShowLockHandoffHint(false);
        return;
      }

      if (
        options?.showHandoffHint === true ||
        (options?.showHandoffHint !== false && previousLocked === false)
      ) {
        triggerLockHandoffHint();
      }
    },
    [clearLockHandoffHint, triggerLockHandoffHint],
  );

  const lockAuraOverlay = useCallback(() => {
    applyAuraLockState(true, { showHandoffHint: true });
    return window.electron.overlayWindows
      .setAuraLocked(true)
      .catch(() => applyAuraLockState(false, { showHandoffHint: false }));
  }, [applyAuraLockState]);

  useEffect(() => clearLockHandoffHint, [clearLockHandoffHint]);

  useEffect(() => {
    let disposed = false;

    void window.electron.overlayWindows
      .isAuraLocked()
      .then((locked) => {
        if (!disposed) {
          applyAuraLockState(locked, { showHandoffHint: false });
        }
      })
      .catch(() => {});

    const unsubscribe =
      window.electron.overlayWindows.onAuraLockChanged(applyAuraLockState);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [applyAuraLockState]);

  return {
    auraOverlayLocked,
    lockAuraOverlay,
    showLockHandoffHint,
  };
}

export { useAuraOverlayLockState };
