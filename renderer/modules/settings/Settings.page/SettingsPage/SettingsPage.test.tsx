import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../Settings.components/AppSettingsCard/AppSettingsCard", () => ({
  AppSettingsCard: () => <div>App settings card</div>,
}));
vi.mock(
  "../../Settings.components/GameLogSettingsCard/GameLogSettingsCard",
  () => ({
    GameLogSettingsCard: () => <div>Game settings card</div>,
  }),
);
vi.mock("../../Settings.components/HelpSettingsCard/HelpSettingsCard", () => ({
  HelpSettingsCard: () => <div>Help settings card</div>,
}));
vi.mock(
  "../../Settings.components/KeybindsSettingsCard/KeybindsSettingsCard",
  () => ({
    KeybindsSettingsCard: () => <div>Keybinds settings card</div>,
  }),
);
vi.mock(
  "../../Settings.components/OverlaySettingsCard/OverlaySettingsCard",
  () => ({
    OverlaySettingsCard: () => <div>Overlay settings card</div>,
  }),
);
vi.mock(
  "../../Settings.components/PrivacySettingsCard/PrivacySettingsCard",
  () => ({
    PrivacySettingsCard: () => <div>Privacy settings card</div>,
  }),
);
vi.mock(
  "../../Settings.components/ProfileTransferSettingsCard/ProfileTransferSettingsCard",
  () => ({
    ProfileTransferSettingsCard: () => <div>Profile transfer card</div>,
  }),
);
vi.mock(
  "../../Settings.components/StorageSettingsCard/StorageSettingsCard",
  () => ({
    StorageSettingsCard: () => <div>Storage settings card</div>,
  }),
);
vi.mock(
  "../../Settings.components/TroubleshootingSettingsCard/TroubleshootingSettingsCard",
  () => ({
    TroubleshootingSettingsCard: () => <div>Troubleshooting card</div>,
  }),
);
vi.mock(
  "~/renderer/modules/profiles/Profiles.components/ProfilesPanel/ProfilesPanel",
  () => ({
    ProfilesPanel: () => <div>Profiles panel</div>,
  }),
);

import {
  getSettingsCategoryFromSlug,
  getSettingsCategorySlug,
  type SettingsCategory,
  SettingsPage,
} from "./SettingsPage";

let container: HTMLDivElement;
let root: Root;

async function renderSettingsPage(
  initialCategory: SettingsCategory = "Game",
  onCategoryChange = vi.fn(),
) {
  await act(async () => {
    root.render(
      <SettingsPage
        initialCategory={initialCategory}
        onCategoryChange={onCategoryChange}
      />,
    );
  });

  return { onCategoryChange };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("opens the Help tab from the initial route category", async () => {
    await renderSettingsPage("Help");

    const tabs = container.querySelector('[aria-label="Settings sections"]');

    expect(container.textContent).toContain("Help settings card");
    expect(tabs?.className).toContain("rounded-md");
    expect(tabs?.className).toContain("bg-base-300");
    expect(
      container
        .querySelector("#settings-tab-help")
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    expect(container.querySelector("#settings-tab-help")?.className).toContain(
      "!bg-primary",
    );
    expect(container.querySelector("#settings-panel-help")).not.toBeNull();
  });

  it("syncs the active tab when the route category changes", async () => {
    await renderSettingsPage("Game");

    expect(container.textContent).toContain("Game settings card");

    await act(async () => {
      root.render(<SettingsPage initialCategory="Help" />);
    });

    expect(container.textContent).not.toContain("Game settings card");
    expect(container.textContent).toContain("Help settings card");
  });

  it("notifies callers when a settings tab is selected", async () => {
    const onCategoryChange = vi.fn();
    await renderSettingsPage("Help", onCategoryChange);
    const appTab =
      container.querySelector<HTMLButtonElement>("#settings-tab-app");

    await act(async () => {
      appTab?.click();
    });

    expect(onCategoryChange).toHaveBeenCalledWith("App");
    expect(container.textContent).toContain("App settings card");
    expect(container.textContent).not.toContain("Keybinds settings card");
  });

  it("opens keybinds as a standalone settings tab", async () => {
    await renderSettingsPage("Keybinds");

    expect(container.textContent).toContain("Keybinds settings card");
    expect(container.textContent).not.toContain("App settings card");
    expect(
      container
        .querySelector("#settings-tab-keybinds")
        ?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("opens overlay as a standalone settings tab", async () => {
    await renderSettingsPage("Overlay");

    expect(container.textContent).toContain("Overlay settings card");
    expect(container.textContent).not.toContain("App settings card");
    expect(
      container
        .querySelector("#settings-tab-overlay")
        ?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("maps settings categories to stable route slugs", () => {
    expect(getSettingsCategorySlug("Help")).toBe("help");
    expect(getSettingsCategorySlug("Keybinds")).toBe("keybinds");
    expect(getSettingsCategorySlug("Overlay")).toBe("overlay");
    expect(getSettingsCategorySlug("Data & Storage")).toBe("data-storage");
    expect(getSettingsCategoryFromSlug("help")).toBe("Help");
    expect(getSettingsCategoryFromSlug("keybinds")).toBe("Keybinds");
    expect(getSettingsCategoryFromSlug("overlay")).toBe("Overlay");
    expect(getSettingsCategoryFromSlug("data-storage")).toBe("Data & Storage");
    expect(getSettingsCategoryFromSlug("missing")).toBeNull();
    expect(getSettingsCategoryFromSlug(null)).toBeNull();
  });
});
