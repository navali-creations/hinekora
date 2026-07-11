type MediaRenderPriority = "high" | "normal";

interface MediaRenderQueueOptions {
  priority?: MediaRenderPriority;
  rejectIfBusy?: boolean;
  signal?: AbortSignal;
}

interface MediaRenderJob<T> {
  abortListener?: () => void;
  operation: () => Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
  signal?: AbortSignal;
}

class MediaRenderQueueBusyError extends Error {
  constructor() {
    super("Media renderer is busy");
    this.name = "MediaRenderQueueBusyError";
  }
}

class MediaRenderQueueFullError extends Error {
  constructor() {
    super("Media render queue is full");
    this.name = "MediaRenderQueueFullError";
  }
}

class MediaRenderQueue {
  private active = false;
  private readonly highPriorityJobs: Array<MediaRenderJob<unknown>> = [];
  private readonly normalPriorityJobs: Array<MediaRenderJob<unknown>> = [];

  constructor(private readonly maxPendingJobs = 8) {}

  enqueue<T>(
    operation: () => Promise<T>,
    options: MediaRenderQueueOptions = {},
  ): Promise<T> {
    if (options.rejectIfBusy && this.active) {
      return Promise.reject(new MediaRenderQueueBusyError());
    }
    if (this.pendingCount >= this.maxPendingJobs) {
      return Promise.reject(new MediaRenderQueueFullError());
    }
    if (options.signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    return new Promise<T>((resolve, reject) => {
      const job: MediaRenderJob<T> = {
        operation,
        reject,
        resolve,
        ...(options.signal ? { signal: options.signal } : {}),
      };
      const queue =
        options.priority === "high"
          ? this.highPriorityJobs
          : this.normalPriorityJobs;
      queue.push(job as MediaRenderJob<unknown>);
      if (options.signal) {
        job.abortListener = () =>
          this.abortQueuedJob(queue, job as MediaRenderJob<unknown>);
        options.signal.addEventListener("abort", job.abortListener, {
          once: true,
        });
      }
      this.runNext();
    });
  }

  private get pendingCount(): number {
    return this.highPriorityJobs.length + this.normalPriorityJobs.length;
  }

  private abortQueuedJob(
    queue: Array<MediaRenderJob<unknown>>,
    job: MediaRenderJob<unknown>,
  ): void {
    const index = queue.indexOf(job);
    queue.splice(index, 1);
    job.reject(createAbortError());
  }

  private runNext(): void {
    if (this.active) {
      return;
    }
    const job =
      this.highPriorityJobs.shift() ?? this.normalPriorityJobs.shift();
    if (!job) {
      return;
    }

    if (job.signal && job.abortListener) {
      job.signal.removeEventListener("abort", job.abortListener);
    }
    this.active = true;
    void Promise.resolve()
      .then(job.operation)
      .then(job.resolve, job.reject)
      .finally(() => {
        this.active = false;
        this.runNext();
      });
  }
}

function createAbortError(): Error {
  const error = new Error("Media render was cancelled");
  error.name = "AbortError";
  return error;
}

const mediaRenderQueue = new MediaRenderQueue();

export type { MediaRenderPriority, MediaRenderQueueOptions };
export {
  MediaRenderQueue,
  MediaRenderQueueBusyError,
  MediaRenderQueueFullError,
  mediaRenderQueue,
};
