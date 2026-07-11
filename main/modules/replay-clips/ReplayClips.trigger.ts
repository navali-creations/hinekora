import type { ReplayClip } from "~/types";
import type { ReplayTriggerEvent } from "./ReplayClips.dto";

interface ReplayClipTriggerExecution {
  execute: (event: ReplayTriggerEvent) => Promise<ReplayClip | null>;
  onCoalesced: (event: ReplayTriggerEvent) => void;
  resolveBatch: (
    clip: ReplayClip | null,
    events: ReplayTriggerEvent[],
  ) => Promise<ReplayClip | null>;
}

class ReplayClipTriggerCoordinator {
  private activeEvents: ReplayTriggerEvent[] | null = null;
  private activeRequest: Promise<ReplayClip | null> | null = null;

  run(
    event: ReplayTriggerEvent,
    execution: ReplayClipTriggerExecution,
  ): Promise<ReplayClip | null> {
    if (this.activeRequest && this.activeEvents) {
      this.activeEvents.push(event);
      execution.onCoalesced(event);
      return this.activeRequest;
    }

    const events = [event];
    this.activeEvents = events;
    const request = execution
      .execute(event)
      .then((clip) => execution.resolveBatch(clip, events))
      .finally(() => {
        this.activeRequest = null;
        this.activeEvents = null;
      });
    this.activeRequest = request;
    return request;
  }
}

export { ReplayClipTriggerCoordinator };
