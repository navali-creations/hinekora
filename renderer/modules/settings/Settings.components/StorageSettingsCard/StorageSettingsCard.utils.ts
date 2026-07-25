function getStorageSettingsError(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to update storage";
}

export { getStorageSettingsError };
