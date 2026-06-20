enum ManagedRecorderChannel {
  GetStatus = "managed-recorder:get-status",
  StartBuffer = "managed-recorder:start-buffer",
  StopBuffer = "managed-recorder:stop-buffer",
  StartRunRecording = "managed-recorder:start-run-recording",
  StopRunRecording = "managed-recorder:stop-run-recording",
  SaveReplay = "managed-recorder:save-replay",
  StatusChanged = "managed-recorder:status-changed",
}

export { ManagedRecorderChannel };
