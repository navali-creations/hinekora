import type { KeybindAction } from "~/types";

interface KeybindRegistrationStatusItem {
  accelerator: string | null;
  displayLabel: string | null;
  error: string | null;
  registered: boolean;
}

type KeybindRegistrationStatus = Record<
  KeybindAction,
  KeybindRegistrationStatusItem
>;

export type { KeybindRegistrationStatus, KeybindRegistrationStatusItem };
