import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type EditorTimelinePlaybackRate,
  editorTimelinePlaybackRates,
} from "~/types";
import {
  getEnabledMenuItems,
  resolveSpeedMenuPosition,
} from "../EditorTimelineSpeedMenu.utils";

type InitialMenuFocus = "first" | "last" | "selected";

function useEditorTimelineSpeedMenu(input: {
  canChangeClipSpeed: boolean;
  selectedPlaybackRate: EditorTimelinePlaybackRate;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialMenuFocusRef = useRef<InitialMenuFocus>("selected");
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    bottom: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (input.canChangeClipSpeed || !isOpen) {
      return;
    }

    setIsOpen(false);
  }, [input.canChangeClipSpeed, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const updateMenuPosition = () => {
      const position = resolveSpeedMenuPosition(triggerRef.current);
      if (position) {
        setMenuPosition(position);
      }
    };
    const focusFrame = window.requestAnimationFrame(() => {
      focusInitialMenuItem({
        initialFocus: initialMenuFocusRef.current,
        items: menuItemRefs.current,
        selectedPlaybackRate: input.selectedPlaybackRate,
      });
    });

    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [input.selectedPlaybackRate, isOpen]);

  const openMenu = (initialFocus: InitialMenuFocus) => {
    const position = resolveSpeedMenuPosition(triggerRef.current);
    if (!position) {
      return;
    }

    initialMenuFocusRef.current = initialFocus;
    setMenuPosition(position);
    setIsOpen(true);
  };
  const closeMenuAndFocusTrigger = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const handleToggleMenu = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    openMenu("selected");
  };
  const handleTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    openMenu(event.key === "ArrowDown" ? "first" : "last");
  };
  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.key === "Tab") {
      closeMenuAndFocusTrigger();
      return;
    }
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const enabledItems = getEnabledMenuItems(menuItemRefs.current);
    if (enabledItems.length === 0) {
      return;
    }

    event.preventDefault();
    focusNextMenuItem({ enabledItems, eventKey: event.key });
  };
  const setMenuItemRef = (index: number, item: HTMLButtonElement | null) => {
    menuItemRefs.current[index] = item;
  };

  return {
    closeMenuAndFocusTrigger,
    containerRef,
    handleMenuKeyDown,
    handleToggleMenu,
    handleTriggerKeyDown,
    isOpen,
    menuPosition,
    menuRef,
    setMenuItemRef,
    triggerRef,
  };
}

function focusInitialMenuItem(input: {
  initialFocus: InitialMenuFocus;
  items: Array<HTMLButtonElement | null>;
  selectedPlaybackRate: EditorTimelinePlaybackRate;
}) {
  const enabledItems = getEnabledMenuItems(input.items);
  const selectedItem =
    input.items[
      editorTimelinePlaybackRates.indexOf(input.selectedPlaybackRate)
    ];
  if (input.initialFocus === "first") {
    enabledItems[0]?.focus();
    return;
  }
  if (input.initialFocus === "last") {
    enabledItems.at(-1)?.focus();
    return;
  }

  if (selectedItem && !selectedItem.disabled) {
    selectedItem.focus();
    return;
  }

  enabledItems[0]?.focus();
}

function focusNextMenuItem(input: {
  enabledItems: HTMLButtonElement[];
  eventKey: "ArrowDown" | "ArrowUp" | "End" | "Home";
}) {
  if (input.eventKey === "Home") {
    input.enabledItems[0]?.focus();
    return;
  }
  if (input.eventKey === "End") {
    input.enabledItems.at(-1)?.focus();
    return;
  }

  const activeElement = document.activeElement;
  const currentIndex =
    activeElement instanceof HTMLButtonElement
      ? input.enabledItems.indexOf(activeElement)
      : -1;
  const direction = input.eventKey === "ArrowDown" ? 1 : -1;
  const nextIndex =
    (Math.max(currentIndex, 0) + direction + input.enabledItems.length) %
    input.enabledItems.length;
  input.enabledItems[nextIndex]?.focus();
}

export { useEditorTimelineSpeedMenu };
