import type { SettingsSlice } from "~/renderer/store/store.types";

function selectAuraOverlayPageSettings(settings: SettingsSlice["settings"]) {
  return {
    activeGame: settings.value?.activeGame ?? "poe1",
    enableSnapping: settings.value?.auraOverlayEnableSnapping ?? false,
    hideLabels: settings.value?.auraOverlayHideLabels ?? false,
    hideProperties: settings.value?.auraOverlayHidePropertiesPanel ?? false,
    showFrame: settings.value?.auraOverlayShowEditingFrame ?? true,
    showGrid: settings.value?.auraOverlayShowEditingGrid ?? false,
  };
}

export { selectAuraOverlayPageSettings };
