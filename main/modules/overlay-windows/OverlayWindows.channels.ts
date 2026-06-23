enum OverlayWindowsChannel {
  ShowRecorder = "overlay-windows:show-recorder",
  HideRecorder = "overlay-windows:hide-recorder",
  ToggleRecorder = "overlay-windows:toggle-recorder",
  IsRecorderVisible = "overlay-windows:is-recorder-visible",
  RecorderVisibilityChanged = "overlay-windows:recorder-visibility-changed",
  GetRecorderMode = "overlay-windows:get-recorder-mode",
  SetRecorderMode = "overlay-windows:set-recorder-mode",
  RecorderModeChanged = "overlay-windows:recorder-mode-changed",
  HideClipPreview = "overlay-windows:hide-clip-preview",
  ShowAura = "overlay-windows:show-aura",
  IsAuraLocked = "overlay-windows:is-aura-locked",
  SetAuraLocked = "overlay-windows:set-aura-locked",
  AuraLockChanged = "overlay-windows:aura-lock-changed",
  AuraAddRequested = "overlay-windows:aura-add-requested",
  SelectCropRegion = "overlay-windows:select-crop-region",
  CompleteCropRegionSelection = "overlay-windows:complete-crop-region-selection",
  CancelCropRegionSelection = "overlay-windows:cancel-crop-region-selection",
}

export { OverlayWindowsChannel };
