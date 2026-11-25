import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./TooltipLayer.module.css";
import {
  getTooltipPlacement,
  getTooltipPosition,
  getTooltipTrigger,
} from "./TooltipLayer.utils";

interface ActiveTooltip {
  content: string;
  trigger: HTMLElement;
}

function TooltipLayer() {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    const show = (trigger: HTMLElement | null) => {
      const content = trigger?.dataset.tip;
      setActive((previous) => {
        if (!trigger || !content?.trim()) return null;
        return previous?.trigger === trigger && previous.content === content
          ? previous
          : { content, trigger };
      });
    };
    const handlePointerOver = (event: PointerEvent) => {
      hovered = getTooltipTrigger(event.target);
      show(hovered ?? focused);
    };
    const handlePointerOut = (event: PointerEvent) => {
      hovered = getTooltipTrigger(event.relatedTarget);
      show(hovered ?? focused);
    };
    const handleFocusIn = (event: FocusEvent) => {
      focused = getTooltipTrigger(event.target);
      show(focused ?? hovered);
    };
    const handleFocusOut = (event: FocusEvent) => {
      focused = getTooltipTrigger(event.relatedTarget);
      show(focused ?? hovered);
    };
    const dismiss = () => {
      hovered = null;
      focused = null;
      setActive(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    const previousMarker = document.documentElement.dataset.managedTooltips;
    document.documentElement.dataset.managedTooltips = "true";
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      if (previousMarker === undefined) {
        delete document.documentElement.dataset.managedTooltips;
      } else {
        document.documentElement.dataset.managedTooltips = previousMarker;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!active || !bubble) return;
    const { trigger } = active;
    const variant =
      [
        "primary",
        "secondary",
        "accent",
        "info",
        "success",
        "warning",
        "error",
      ].find((color) => trigger.classList.contains(`tooltip-${color}`)) ??
      "neutral";
    bubble.style.backgroundColor = `var(--color-${variant})`;
    bubble.style.color = `var(--color-${variant}-content)`;
    let lastAnchor = trigger.getBoundingClientRect();
    let animationFrame: number;
    const updatePosition = (anchor = trigger.getBoundingClientRect()) => {
      lastAnchor = anchor;
      const bubbleBounds = bubble.getBoundingClientRect();
      const position = getTooltipPosition({
        anchor,
        height: bubbleBounds.height,
        placement: getTooltipPlacement(trigger),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        width: bubbleBounds.width,
      });
      bubble.style.left = `${position.left}px`;
      bubble.style.top = `${position.top}px`;
    };
    bubble.showPopover?.();
    updatePosition();
    const trackAnchor = () => {
      if (!trigger.isConnected) {
        setActive(null);
        return;
      }
      const anchor = trigger.getBoundingClientRect();
      if (
        anchor.left !== lastAnchor.left ||
        anchor.top !== lastAnchor.top ||
        anchor.width !== lastAnchor.width ||
        anchor.height !== lastAnchor.height
      ) {
        updatePosition(anchor);
      }
      animationFrame = window.requestAnimationFrame(trackAnchor);
    };
    animationFrame = window.requestAnimationFrame(trackAnchor);
    const description = trigger.getAttribute("aria-describedby");
    trigger.setAttribute(
      "aria-describedby",
      [description, id].filter(Boolean).join(" "),
    );
    const observer = new MutationObserver(() => {
      const content = trigger.dataset.tip;
      setActive(content?.trim() ? { content, trigger } : null);
    });
    observer.observe(trigger, {
      attributes: true,
      attributeFilter: ["data-tip"],
    });
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => updatePosition());
    resizeObserver?.observe(bubble);

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrame);
      bubble.hidePopover?.();
      if (description === null) trigger.removeAttribute("aria-describedby");
      else trigger.setAttribute("aria-describedby", description);
    };
  }, [active, id]);

  if (!active) return null;

  return createPortal(
    <div
      className={styles.bubble}
      id={id}
      popover="manual"
      ref={bubbleRef}
      role="tooltip"
    >
      {active.content}
    </div>,
    document.body,
  );
}

export { TooltipLayer };
