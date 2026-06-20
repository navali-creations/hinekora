import EventEmitter from "node:events";

abstract class Poller<T> extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private previousState: T | undefined;
  private active = false;
  private pollRequest: Promise<T> | null = null;

  constructor(private readonly intervalMs: number) {
    super();
  }

  get isPollerRunning(): boolean {
    return this.interval !== null;
  }

  start(): void {
    if (this.interval) {
      return;
    }

    this.pollScheduled();
    this.interval = setInterval(() => {
      this.pollScheduled();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
    this.active = false;
    this.previousState = undefined;
  }

  pollNow(): Promise<T> {
    return this.poll();
  }

  protected abstract pollOnce(): Promise<T>;

  protected abstract isStateActive(state: T): boolean;

  protected hasStateChanged(previous: T | undefined, current: T): boolean {
    return previous !== current;
  }

  protected onStart(_state: T): void {
    // Optional subclass hook.
  }

  protected onStop(_previousState: T): void {
    // Optional subclass hook.
  }

  protected onData(_state: T): void {
    // Optional subclass hook.
  }

  private pollScheduled(): void {
    void this.poll().catch(() => {
      // The error event carries scheduled poll failures to consumers.
    });
  }

  private poll(): Promise<T> {
    if (this.pollRequest) {
      return this.pollRequest;
    }

    this.pollRequest = this.runPoll().finally(() => {
      this.pollRequest = null;
    });

    return this.pollRequest;
  }

  private async runPoll(): Promise<T> {
    try {
      const currentState = await this.pollOnce();
      this.emit("data", currentState);
      this.onData(currentState);

      if (this.hasStateChanged(this.previousState, currentState)) {
        const currentActive = this.isStateActive(currentState);
        if (!this.active && currentActive) {
          this.active = true;
          this.emit("start", currentState);
          this.onStart(currentState);
        } else if (this.active && !currentActive) {
          this.active = false;
          this.emit("stop", this.previousState);
          if (this.previousState !== undefined) {
            this.onStop(this.previousState);
          }
        }

        this.previousState = currentState;
      }

      return currentState;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }
}

export { Poller };
