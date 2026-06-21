import clsx from "clsx";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface ModalHandle {
  open: () => void;
  close: () => void;
}

interface ModalProps {
  children: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
  onClose?: () => void;
  size?: "sm" | "md" | "lg";
  surface?: "base-100" | "base-200" | "base-300";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
};

const scrimFadeMs = 300;
const surfaceClasses: Record<NonNullable<ModalProps["surface"]>, string> = {
  "base-100": "bg-base-100",
  "base-200": "bg-base-200",
  "base-300": "bg-base-300",
};

const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(
  {
    children,
    className,
    closeOnBackdrop = true,
    onClose,
    size = "md",
    surface = "base-300",
  },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrimMounted, setIsScrimMounted] = useState(false);
  const [isScrimVisible, setIsScrimVisible] = useState(false);

  const clearScrimTimer = useCallback(() => {
    if (!scrimTimerRef.current) {
      return;
    }

    clearTimeout(scrimTimerRef.current);
    scrimTimerRef.current = null;
  }, []);

  const showScrim = useCallback(() => {
    clearScrimTimer();
    setIsScrimMounted(true);
    setIsScrimVisible(true);
  }, [clearScrimTimer]);

  const hideScrim = useCallback(() => {
    clearScrimTimer();
    setIsScrimVisible(false);
    scrimTimerRef.current = setTimeout(() => {
      setIsScrimMounted(false);
      scrimTimerRef.current = null;
    }, scrimFadeMs);
  }, [clearScrimTimer]);

  useEffect(() => clearScrimTimer, [clearScrimTimer]);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        showScrim();
        if (!dialogRef.current?.open) {
          dialogRef.current?.showModal();
        }
      },
      close: () => {
        hideScrim();
        dialogRef.current?.close();
      },
    }),
    [hideScrim, showScrim],
  );

  const handleClose = () => {
    hideScrim();
    onClose?.();
  };

  const modal = (
    <>
      {isScrimMounted && (
        <div
          aria-hidden="true"
          className={clsx(
            "pointer-events-none fixed inset-0 z-40 bg-base-300/45 backdrop-blur-sm transition-opacity duration-300",
            isScrimVisible ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      <dialog
        ref={dialogRef}
        className="modal modal-bottom !bg-transparent outline-none focus:outline-none focus-visible:outline-none sm:modal-middle"
        onClose={handleClose}
      >
        {closeOnBackdrop && (
          <form
            method="dialog"
            className="col-start-1 row-start-1 grid place-self-stretch text-transparent"
          >
            <button
              type="submit"
              className="btn h-auto min-h-0 w-full border-0 bg-transparent p-0 text-transparent hover:bg-transparent"
              tabIndex={-1}
              aria-label="Close modal"
            />
          </form>
        )}
        <div
          className={clsx(
            "modal-box border border-black shadow-[0_0_18px_0_rgba(0,0,0,0.5)]",
            surfaceClasses[surface],
            sizeClasses[size],
            className,
          )}
        >
          {children}
        </div>
      </dialog>
    </>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
});

export { Modal };
