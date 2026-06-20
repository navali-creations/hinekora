import { findRunningProcess } from "./isProcessRunning";
import { Poller } from "./Poller";

interface ProcessState {
  isRunning: boolean;
  processName: string;
}

interface ProcessPollerOptions {
  inactivePollsBeforeStop?: number;
}

class ProcessPoller extends Poller<ProcessState> {
  private inactivePolls = 0;
  private lastActiveState: ProcessState | null = null;

  constructor(
    private readonly processNames: readonly string[],
    intervalMs: number,
    private readonly options: ProcessPollerOptions = {},
  ) {
    super(intervalMs);
  }

  protected override async pollOnce(): Promise<ProcessState> {
    const processName = await findRunningProcess(this.processNames);

    return this.stabilizeProcessState({
      isRunning: processName !== null,
      processName: processName ?? "",
    });
  }

  protected stabilizeProcessState(state: ProcessState): ProcessState {
    const inactivePollsBeforeStop = Math.max(
      1,
      this.options.inactivePollsBeforeStop ?? 1,
    );

    if (state.isRunning) {
      this.inactivePolls = 0;
      this.lastActiveState = state;
      return state;
    }

    if (
      this.lastActiveState &&
      this.inactivePolls < inactivePollsBeforeStop - 1
    ) {
      this.inactivePolls += 1;
      return this.lastActiveState;
    }

    this.inactivePolls = 0;
    this.lastActiveState = null;
    return state;
  }

  protected override isStateActive(state: ProcessState): boolean {
    return state.isRunning;
  }

  protected override hasStateChanged(
    previous: ProcessState | undefined,
    current: ProcessState,
  ): boolean {
    return (
      previous?.isRunning !== current.isRunning ||
      previous?.processName !== current.processName
    );
  }
}

export type { ProcessPollerOptions, ProcessState };
export { ProcessPoller };
