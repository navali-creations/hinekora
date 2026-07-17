function getRecordingStorageSettingsError(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to update storage";
}

export { getRecordingStorageSettingsError };
