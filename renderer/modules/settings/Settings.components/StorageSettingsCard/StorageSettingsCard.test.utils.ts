import { act } from "react";

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(input, value);
}

async function changeAndBlur(
  input: HTMLInputElement,
  value: string,
): Promise<void> {
  await act(async () => {
    setNativeInputValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

function findButton(label: string): HTMLButtonElement {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((candidate) => candidate.textContent?.trim() === label);
  if (!button) {
    throw new Error(`Expected ${label} button`);
  }
  return button;
}

export { changeAndBlur, findButton, setNativeInputValue };
