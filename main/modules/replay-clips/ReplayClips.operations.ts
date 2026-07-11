interface ReplayClipOperationRequest<T> {
  promise: Promise<T>;
  settled: boolean;
}

const maxRememberedOperationRequests = 256;

class ReplayClipOperationCoordinator {
  private readonly clipQueues = new Map<string, Promise<void>>();
  private readonly requestResults = new Map<
    string,
    ReplayClipOperationRequest<unknown>
  >();
  private storedFileMutationQueue: Promise<void> = Promise.resolve();

  async queueClipOperation<T>(
    clipId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.clipQueues.get(clipId) ?? Promise.resolve();
    const run = previous.then(operation);
    const queued = run.then(
      () => undefined,
      () => undefined,
    );
    this.clipQueues.set(clipId, queued);

    try {
      return await run;
    } finally {
      if (this.clipQueues.get(clipId) === queued) {
        this.clipQueues.delete(clipId);
      }
    }
  }

  queueClipOperations<T>(
    clipIds: string[],
    operation: () => Promise<T>,
  ): Promise<T> {
    const uniqueClipIds = [...new Set(clipIds)].sort();
    const acquire = (index: number): Promise<T> => {
      const clipId = uniqueClipIds[index];
      return clipId
        ? this.queueClipOperation(clipId, () => acquire(index + 1))
        : operation();
    };

    return acquire(0);
  }

  queueStoredFileMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.storedFileMutationQueue.then(operation);
    this.storedFileMutationQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  runIdempotent<T>(
    requestKey: string | null,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!requestKey) {
      return operation();
    }

    const existing = this.requestResults.get(requestKey);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    const request: ReplayClipOperationRequest<T> = {
      promise: Promise.resolve(undefined as T),
      settled: false,
    };
    request.promise = operation().finally(() => {
      request.settled = true;
      this.evictSettledRequests();
    });
    this.requestResults.set(requestKey, request);
    this.evictSettledRequests();
    return request.promise;
  }

  private evictSettledRequests(): void {
    if (this.requestResults.size <= maxRememberedOperationRequests) {
      return;
    }

    for (const [key, request] of this.requestResults) {
      if (request.settled) {
        this.requestResults.delete(key);
      }
      if (this.requestResults.size <= maxRememberedOperationRequests) {
        return;
      }
    }
  }
}

export { ReplayClipOperationCoordinator };
