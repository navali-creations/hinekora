import { describe, expect, it } from "vitest";

import {
  Keybind,
  KeybindAcceleratorSchema,
  keybindActionConfigs,
  keybindActions,
} from "./keybinds";

describe("Keybind", () => {
  it("normalizes string accelerators for Electron and display", () => {
    const keybind = new Keybind("shift + alt + b");

    expect(keybind.toElectronAccelerator()).toBe("Alt+Shift+B");
    expect(keybind.toDisplayLabel()).toBe("ALT + SHIFT + B");
    expect(keybind.toString()).toBe("Alt+Shift+B");
  });

  it("accepts single-key keyboard accelerators", () => {
    const keybind = new Keybind("del");

    expect(keybind.toElectronAccelerator()).toBe("Delete");
    expect(keybind.toDisplayLabel()).toBe("DELETE");
  });

  it("creates keybinds from keyboard input", () => {
    const keybind = Keybind.fromUserInput({
      altKey: true,
      code: "KeyC",
      ctrlKey: false,
      key: "c",
      metaKey: false,
      shiftKey: false,
    });

    expect(keybind?.toElectronAccelerator()).toBe("Alt+C");
    expect(keybind?.toDisplayLabel()).toBe("ALT + C");
  });

  it("previews modifier-only input while recording", () => {
    expect(
      Keybind.previewUserInput({
        altKey: false,
        ctrlKey: false,
        key: "Meta",
        metaKey: true,
        shiftKey: true,
      }),
    ).toBe("SHIFT + META");
    expect(
      Keybind.previewUserInput({
        altKey: true,
        ctrlKey: false,
        key: "b",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe("ALT + B");
  });

  it("records single-key keyboard input", () => {
    const keybind = Keybind.fromUserInput({
      altKey: false,
      ctrlKey: false,
      key: "b",
      metaKey: false,
      shiftKey: false,
    });

    expect(keybind?.toElectronAccelerator()).toBe("B");
    expect(keybind?.toDisplayLabel()).toBe("B");
  });

  it("maps numpad keyboard input to Electron accelerator names", () => {
    const keybind = Keybind.fromUserInput({
      altKey: true,
      code: "Numpad1",
      ctrlKey: false,
      key: "1",
      metaKey: false,
      shiftKey: false,
    });

    expect(keybind?.toElectronAccelerator()).toBe("Alt+num1");
    expect(keybind?.toDisplayLabel()).toBe("ALT + NUM1");
  });

  it("keeps punctuation keyboard input in Electron accelerator form", () => {
    const semicolonKeybind = Keybind.fromUserInput({
      altKey: true,
      code: "Semicolon",
      ctrlKey: false,
      key: ";",
      metaKey: false,
      shiftKey: false,
    });
    const plusKeybind = Keybind.fromUserInput({
      altKey: true,
      code: "Equal",
      ctrlKey: false,
      key: "+",
      metaKey: false,
      shiftKey: true,
    });

    expect(semicolonKeybind?.toElectronAccelerator()).toBe("Alt+;");
    expect(semicolonKeybind?.toDisplayLabel()).toBe("ALT + ;");
    expect(plusKeybind?.toElectronAccelerator()).toBe("Alt+Shift+Plus");
    expect(plusKeybind?.toDisplayLabel()).toBe("ALT + SHIFT + +");
  });

  it("normalizes persisted punctuation accelerators", () => {
    expect(new Keybind("alt+;").toElectronAccelerator()).toBe("Alt+;");
    expect(new Keybind("alt+minus").toElectronAccelerator()).toBe("Alt+-");
    expect(new Keybind("alt+plus").toElectronAccelerator()).toBe("Alt+Plus");
  });

  it("normalizes function-key and numpad accelerators", () => {
    expect(new Keybind("alt+f12").toElectronAccelerator()).toBe("Alt+F12");
    expect(new Keybind("ctrl+numadd").toDisplayLabel()).toBe("CTRL + NUMADD");
  });

  it("rejects shortcuts without a final key", () => {
    expect(
      Keybind.fromUserInput({
        altKey: true,
        ctrlKey: false,
        key: "Alt",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
  });

  it("rejects repeated and unsupported keyboard input", () => {
    expect(
      Keybind.fromUserInput({
        altKey: true,
        ctrlKey: false,
        key: "b",
        metaKey: false,
        repeat: true,
        shiftKey: false,
      }),
    ).toBeNull();
    expect(
      Keybind.fromUserInput({
        altKey: false,
        ctrlKey: false,
        key: "\n",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
  });

  it("rejects malformed persisted accelerators", () => {
    expect(() => new Keybind("")).toThrow("Keybind must include one key");
    expect(Keybind.tryParse("Alt+Hyper+B")).toBeNull();
    expect(Keybind.tryParse("Mouse4")).toBeNull();
    expect(Keybind.tryParse("Mouse5")).toBeNull();
    expect(Keybind.tryParse("MouseLeft")).toBeNull();
    expect(Keybind.tryParse("MouseRight")).toBeNull();
    expect(Keybind.tryParse("MouseMiddle")).toBeNull();
    expect(Keybind.tryParse("button4")).toBeNull();
    expect(Keybind.tryParse("mouseback")).toBeNull();
    expect(Keybind.tryParse("xbutton2")).toBeNull();
    expect(Keybind.tryParse("scrollclick")).toBeNull();
    expect(Keybind.tryParse("wheelclick")).toBeNull();
    expect(Keybind.tryParse("leftclick")).toBeNull();
    expect(Keybind.tryParse("rightclick")).toBeNull();
  });

  it("exposes keybind action metadata", () => {
    expect(keybindActions).toEqual(["manualBookmark", "manualReplay"]);
    expect(keybindActionConfigs.manualBookmark).toMatchObject({
      defaultAccelerator: "Alt+B",
      label: "Manual bookmark",
      settingKey: "keybindManualBookmark",
    });
    expect(keybindActionConfigs.manualReplay).toMatchObject({
      defaultAccelerator: "Alt+C",
      label: "Manual replay",
      settingKey: "keybindManualReplay",
    });
  });

  it("validates and transforms persisted accelerators", () => {
    expect(KeybindAcceleratorSchema.parse("alt+c")).toBe("Alt+C");
    expect(KeybindAcceleratorSchema.parse("c")).toBe("C");
    expect(KeybindAcceleratorSchema.parse("alt+num1")).toBe("Alt+num1");
    expect(KeybindAcceleratorSchema.parse("alt+;")).toBe("Alt+;");
    expect(KeybindAcceleratorSchema.parse("alt+plus")).toBe("Alt+Plus");
    expect(KeybindAcceleratorSchema.safeParse("mouse4").success).toBe(false);
    expect(KeybindAcceleratorSchema.safeParse("alt+xbutton2").success).toBe(
      false,
    );
    expect(KeybindAcceleratorSchema.safeParse("alt+wheelclick").success).toBe(
      false,
    );
  });
});
