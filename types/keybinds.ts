import { z } from "zod";

const modifierAliases = new Map<string, KeybindModifier>([
  ["alt", "Alt"],
  ["option", "Alt"],
  ["control", "Ctrl"],
  ["ctrl", "Ctrl"],
  ["cmd", "Meta"],
  ["command", "Meta"],
  ["meta", "Meta"],
  ["shift", "Shift"],
  ["super", "Meta"],
  ["win", "Meta"],
  ["windows", "Meta"],
]);
const modifierOrder: KeybindModifier[] = ["Ctrl", "Alt", "Shift", "Meta"];
const modifierInputKeys = new Set(["Alt", "Control", "Meta", "Shift"]);
const keyNameAliases = new Map<string, string>([
  ["arrowdown", "Down"],
  ["arrowleft", "Left"],
  ["arrowright", "Right"],
  ["arrowup", "Up"],
  ["backspace", "Backspace"],
  ["backquote", "`"],
  ["backslash", "\\"],
  ["bracketleft", "["],
  ["bracketright", "]"],
  ["comma", ","],
  ["delete", "Delete"],
  ["del", "Delete"],
  ["down", "Down"],
  ["end", "End"],
  ["enter", "Return"],
  ["equal", "="],
  ["esc", "Esc"],
  ["escape", "Esc"],
  ["home", "Home"],
  ["insert", "Insert"],
  ["ins", "Insert"],
  ["left", "Left"],
  ["minus", "-"],
  ["pagedown", "PageDown"],
  ["pageup", "PageUp"],
  ["period", "."],
  ["plus", "Plus"],
  ["quote", "'"],
  ["return", "Return"],
  ["right", "Right"],
  ["semicolon", ";"],
  ["slash", "/"],
  ["space", "Space"],
  ["spacebar", "Space"],
  ["tab", "Tab"],
  ["up", "Up"],
]);
const punctuationKeyNames = new Map<string, string>([
  [")", ")"],
  ["!", "!"],
  ["@", "@"],
  ["#", "#"],
  ["$", "$"],
  ["%", "%"],
  ["^", "^"],
  ["&", "&"],
  ["*", "*"],
  ["(", "("],
  [":", ":"],
  [";", ";"],
  ["+", "Plus"],
  ["=", "="],
  ["<", "<"],
  [",", ","],
  ["_", "_"],
  ["-", "-"],
  [">", ">"],
  [".", "."],
  ["?", "?"],
  ["/", "/"],
  ["~", "~"],
  ["`", "`"],
  ["{", "{"],
  ["]", "]"],
  ["[", "["],
  ["|", "|"],
  ["\\", "\\"],
  ["}", "}"],
  ['"', '"'],
  ["'", "'"],
]);
const numpadCodeKeyNames = new Map<string, string>([
  ["Numpad0", "num0"],
  ["Numpad1", "num1"],
  ["Numpad2", "num2"],
  ["Numpad3", "num3"],
  ["Numpad4", "num4"],
  ["Numpad5", "num5"],
  ["Numpad6", "num6"],
  ["Numpad7", "num7"],
  ["Numpad8", "num8"],
  ["Numpad9", "num9"],
  ["NumpadAdd", "numadd"],
  ["NumpadDecimal", "numdec"],
  ["NumpadDivide", "numdiv"],
  ["NumpadMultiply", "nummult"],
  ["NumpadSubtract", "numsub"],
]);
const numpadKeyNames = new Set(numpadCodeKeyNames.values());
const displayKeyNames = new Map<string, string>([
  ["Esc", "ESC"],
  ["Plus", "+"],
  ["Return", "ENTER"],
  ["Space", "SPACE"],
]);

type KeybindModifier = "Alt" | "Ctrl" | "Meta" | "Shift";
type KeybindAction = "manualBookmark" | "manualReplay";
type KeybindSettingKey = "keybindManualBookmark" | "keybindManualReplay";
type KeybindModifierInput = Pick<
  KeybindUserInput,
  "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
>;

interface KeybindUserInput {
  altKey: boolean;
  code?: string;
  ctrlKey: boolean;
  key?: string;
  metaKey: boolean;
  repeat?: boolean;
  shiftKey: boolean;
}

interface KeybindActionConfig {
  defaultAccelerator: string;
  description: string;
  label: string;
  settingKey: KeybindSettingKey;
}

const keybindActions = ["manualBookmark", "manualReplay"] as const;
const keybindActionConfigs = {
  manualBookmark: {
    defaultAccelerator: "Alt+B",
    description: "Create a manual bookmark while session recording is active.",
    label: "Manual bookmark",
    settingKey: "keybindManualBookmark",
  },
  manualReplay: {
    defaultAccelerator: "Alt+C",
    description: "Save a manual replay while rewind is active.",
    label: "Manual replay",
    settingKey: "keybindManualReplay",
  },
} as const satisfies Record<KeybindAction, KeybindActionConfig>;

class Keybind {
  private readonly accelerator: string;

  constructor(input: string) {
    const parsed = parseAccelerator(input);
    if (!parsed) {
      throw new Error("Keybind must include one key");
    }

    this.accelerator = createAccelerator(parsed.modifiers, parsed.key);
  }

  static fromUserInput(input: KeybindUserInput): Keybind | null {
    if (input.repeat === true) {
      return null;
    }

    const key = normalizeUserInputKey(input);
    if (!key) {
      return null;
    }

    const modifiers = collectUserInputModifiers(input);
    return new Keybind(createAccelerator(modifiers, key));
  }

  static previewUserInput(input: KeybindUserInput): string {
    const modifiers = collectUserInputModifiers(input);
    const key = normalizeUserInputKey(input);

    return formatDisplayParts([...modifiers, ...(key ? [key] : [])]);
  }

  static tryParse(input: string | null | undefined): Keybind | null {
    if (!input) {
      return null;
    }

    try {
      return new Keybind(input);
    } catch {
      return null;
    }
  }

  toDisplayLabel(): string {
    return formatDisplayParts(this.accelerator.split("+"));
  }

  toElectronAccelerator(): string {
    return this.accelerator;
  }

  toString(): string {
    return this.accelerator;
  }
}

const KeybindAcceleratorSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => Keybind.tryParse(value) !== null, {
    message: "Invalid keybind accelerator",
  })
  .transform((value) => new Keybind(value).toElectronAccelerator());
const OptionalKeybindAcceleratorSchema =
  KeybindAcceleratorSchema.nullable().default(null);

function collectUserInputModifiers(
  input: KeybindModifierInput,
): KeybindModifier[] {
  return modifierOrder.filter((modifier) => {
    if (modifier === "Alt") {
      return input.altKey;
    }
    if (modifier === "Ctrl") {
      return input.ctrlKey;
    }
    if (modifier === "Meta") {
      return input.metaKey;
    }

    return input.shiftKey;
  });
}

function parseAccelerator(
  input: string,
): { key: string; modifiers: KeybindModifier[] } | null {
  const parts = input
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 1) {
    return null;
  }

  const rawKey = parts[parts.length - 1] as string;

  const key = normalizeKeyName(rawKey);
  if (!key) {
    return null;
  }

  const modifierSet = new Set<KeybindModifier>();
  for (const part of parts.slice(0, -1)) {
    const modifier = modifierAliases.get(part.toLowerCase());
    if (!modifier) {
      return null;
    }
    modifierSet.add(modifier);
  }

  const modifiers = modifierOrder.filter((modifier) =>
    modifierSet.has(modifier),
  );

  return { key, modifiers };
}

function normalizeUserInputKey(input: KeybindUserInput): string | null {
  if (!input.key || modifierInputKeys.has(input.key)) {
    return null;
  }

  return normalizeKeyName(input.key, input.code);
}

function createAccelerator(modifiers: KeybindModifier[], key: string): string {
  return [...modifiers, key].join("+");
}

function normalizeKeyName(key: string, code?: string): string | null {
  const byNumpadCode = code ? numpadCodeKeyNames.get(code) : null;
  if (byNumpadCode) {
    return byNumpadCode;
  }

  if (key.length === 1) {
    const punctuation = punctuationKeyNames.get(key);
    if (punctuation) {
      return punctuation;
    }

    return /^[a-z0-9]$/i.test(key) ? key.toUpperCase() : null;
  }

  const normalizedKey = key.replace(/\s+/g, "").toLowerCase();
  const byAlias = keyNameAliases.get(normalizedKey);
  if (byAlias) {
    return byAlias;
  }

  if (/^f([1-9]|1\d|2[0-4])$/i.test(key)) {
    return key.toUpperCase();
  }

  const normalizedNumpadKey = key.toLowerCase();
  if (numpadKeyNames.has(normalizedNumpadKey)) {
    return normalizedNumpadKey;
  }

  return null;
}

function formatDisplayParts(parts: string[]): string {
  return parts
    .map((part) => displayKeyNames.get(part) ?? part.toUpperCase())
    .join(" + ");
}

export type { KeybindAction, KeybindSettingKey, KeybindUserInput };
export {
  Keybind,
  KeybindAcceleratorSchema,
  keybindActionConfigs,
  keybindActions,
  OptionalKeybindAcceleratorSchema,
};
