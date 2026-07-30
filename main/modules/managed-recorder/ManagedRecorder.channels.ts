enum ManagedRecorderChannel {
  CaptureModeChanged = "managed-recorder:capture-mode-changed",
  GetCaptureMode = "managed-recorder:get-capture-mode",
  GetRecordingStorageEstimates = "managed-recorder:get-recording-storage-estimates",
  ListAudioDevices = "managed-recorder:list-audio-devices",
  GetStatus = "managed-recorder:get-status",
  SetCaptureMode = "managed-recorder:set-capture-mode",
  StartBuffer = "managed-recorder:start-buffer",
  StopBuffer = "managed-recorder:stop-buffer",
  StartRunRecording = "managed-recorder:start-run-recording",
  StopRunRecording = "managed-recorder:stop-run-recording",
  StatusChanged = "managed-recorder:status-changed",
}

export { ManagedRecorderChannel };
