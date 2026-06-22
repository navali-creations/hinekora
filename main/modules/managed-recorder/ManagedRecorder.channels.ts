enum ManagedRecorderChannel {
  CaptureModeChanged = "managed-recorder:capture-mode-changed",
  GetCaptureMode = "managed-recorder:get-capture-mode",
  GetStatus = "managed-recorder:get-status",
  SetCaptureMode = "managed-recorder:set-capture-mode",
  StartBuffer = "managed-recorder:start-buffer",
  StopBuffer = "managed-recorder:stop-buffer",
  StartRunRecording = "managed-recorder:start-run-recording",
  StopRunRecording = "managed-recorder:stop-run-recording",
  SaveReplay = "managed-recorder:save-replay",
  StatusChanged = "managed-recorder:status-changed",
}

export { ManagedRecorderChannel };
