import { describe, expect, it } from "vitest";

import {
  isKeyboardShortcutEditableTarget,
  isKeyboardShortcutSuppressedTarget,
} from "./KeyboardShortcuts.utils";

describe("keyboard shortcut target utilities", () => {
  it("recognizes editable targets", () => {
    const button = document.createElement("button");
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.contentEditable = "true";

    expect(isKeyboardShortcutEditableTarget(button)).toBe(false);
    expect(isKeyboardShortcutEditableTarget(input)).toBe(true);
    expect(isKeyboardShortcutEditableTarget(editable)).toBe(true);
    expect(isKeyboardShortcutEditableTarget(null)).toBe(false);
  });

  it("suppresses shortcuts inside dialogs and menus", () => {
    const dialog = document.createElement("dialog");
    const dialogButton = document.createElement("button");
    const menu = document.createElement("div");
    const menuButton = document.createElement("button");
    dialog.setAttribute("open", "");
    dialog.append(dialogButton);
    menu.setAttribute("role", "menu");
    menu.append(menuButton);
    document.body.append(dialog, menu);

    expect(isKeyboardShortcutSuppressedTarget(dialogButton)).toBe(true);
    expect(isKeyboardShortcutSuppressedTarget(menuButton)).toBe(true);
    expect(isKeyboardShortcutSuppressedTarget(document.body)).toBe(false);
    expect(isKeyboardShortcutSuppressedTarget(null)).toBe(false);

    dialog.remove();
    menu.remove();
  });
});
