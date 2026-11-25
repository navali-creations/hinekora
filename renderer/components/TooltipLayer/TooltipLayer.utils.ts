type TooltipPlacement = "top" | "bottom" | "left" | "right";

const oppositePlacement: Record<TooltipPlacement, TooltipPlacement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function getTooltipPosition(input: {
  anchor: Pick<
    DOMRect,
    "top" | "bottom" | "left" | "right" | "width" | "height"
  >;
  height: number;
  placement: TooltipPlacement;
  viewportHeight: number;
  viewportWidth: number;
  width: number;
}) {
  const { anchor, height, viewportHeight, viewportWidth, width } = input;
  const margin = 8;
  const gap = 8;
  const space = {
    top: anchor.top,
    bottom: viewportHeight - anchor.bottom,
    left: anchor.left,
    right: viewportWidth - anchor.right,
  };
  const placements: TooltipPlacement[] = [
    input.placement,
    oppositePlacement[input.placement],
    "bottom",
    "top",
    "right",
    "left",
  ];
  const placement =
    placements.find(
      (side) =>
        space[side] >=
        (side === "top" || side === "bottom" ? height : width) + gap + margin,
    ) ?? input.placement;
  let left = anchor.left + (anchor.width - width) / 2;
  let top = anchor.top + (anchor.height - height) / 2;

  if (placement === "top") top = anchor.top - height - gap;
  if (placement === "bottom") top = anchor.bottom + gap;
  if (placement === "left") left = anchor.left - width - gap;
  if (placement === "right") left = anchor.right + gap;

  return {
    left: Math.max(margin, Math.min(left, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(top, viewportHeight - height - margin)),
  };
}

function getTooltipTrigger(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const trigger = target.closest(".tooltip[data-tip]:not(.tooltip-open)");
  return trigger instanceof HTMLElement && trigger.dataset.tip?.trim()
    ? trigger
    : null;
}

function getTooltipPlacement(trigger: HTMLElement): TooltipPlacement {
  for (const placement of ["top", "bottom", "left", "right"] as const) {
    if (trigger.classList.contains(`tooltip-${placement}`)) return placement;
  }
  return "top";
}

export { getTooltipPlacement, getTooltipPosition, getTooltipTrigger };
