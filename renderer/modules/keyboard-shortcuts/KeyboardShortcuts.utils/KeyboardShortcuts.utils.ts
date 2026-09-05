function isKeyboardShortcutEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.contentEditable === "true" ||
      target.getAttribute("contenteditable") === "true" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

function isKeyboardShortcutSuppressedTarget(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    isKeyboardShortcutEditableTarget(target) ||
    target.closest('dialog[open], [role="dialog"], [aria-modal="true"]') !==
      null ||
    target.closest('[role="menu"]') !== null
  );
}

export { isKeyboardShortcutEditableTarget, isKeyboardShortcutSuppressedTarget };
