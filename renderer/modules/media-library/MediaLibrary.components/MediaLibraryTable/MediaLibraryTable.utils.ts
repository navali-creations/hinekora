function isInteractiveTableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "a",
        "button",
        "details",
        "input",
        "label",
        "select",
        "summary",
        "textarea",
        "[data-row-click-ignore='true']",
      ].join(","),
    ),
  );
}

export { isInteractiveTableTarget };
