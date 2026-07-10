function dispatchClipPreviewPointerEvent(
  target: Element,
  type: string,
  input: { clientX: number; pointerId?: number; timeStamp?: number },
): void {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as PointerEvent;
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: input.clientX },
    pointerId: { value: input.pointerId ?? 1 },
    timeStamp: { value: input.timeStamp ?? 0 },
  });
  target.dispatchEvent(event);
}

function getClipPreviewTrimRail(container: ParentNode): HTMLElement {
  const rail = container.querySelector('[aria-label="Clip trim timeline"]');
  if (!(rail instanceof HTMLElement)) {
    throw new Error("Expected trim timeline");
  }

  rail.getBoundingClientRect = () =>
    ({
      bottom: 36,
      height: 36,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  return rail;
}

export { dispatchClipPreviewPointerEvent, getClipPreviewTrimRail };
