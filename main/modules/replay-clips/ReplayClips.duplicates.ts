const replayClipDuplicateWindowMs = 30_000;

class ReplayClipDuplicateTracker {
  private readonly recentDeathHashes = new Map<string, number>();

  isDuplicate(lineHash: string, now = Date.now()): boolean {
    const lastSeen = this.recentDeathHashes.get(lineHash);
    this.recentDeathHashes.set(lineHash, now);

    for (const [hash, timestamp] of this.recentDeathHashes) {
      if (now - timestamp > replayClipDuplicateWindowMs) {
        this.recentDeathHashes.delete(hash);
      }
    }

    return (
      lastSeen !== undefined && now - lastSeen < replayClipDuplicateWindowMs
    );
  }
}

export { ReplayClipDuplicateTracker };
