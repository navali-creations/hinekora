function installEditorDialogMocks() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
}

function getEditorConfirmationDialog(): HTMLDialogElement {
  const dialog = document.body.querySelector<HTMLDialogElement>("dialog");
  if (!dialog) {
    throw new Error("Expected editor confirmation dialog to render");
  }

  return dialog;
}

function getEditorDialogButton(label: string): HTMLButtonElement {
  const button = Array.from(
    getEditorConfirmationDialog().querySelectorAll<HTMLButtonElement>("button"),
  ).find((item) => item.textContent?.trim() === label);
  if (!button) {
    throw new Error(`Expected ${label} dialog button to render`);
  }

  return button;
}

export {
  getEditorConfirmationDialog,
  getEditorDialogButton,
  installEditorDialogMocks,
};
