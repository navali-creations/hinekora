interface PoeProcessState {
  isRunning: boolean;
  processName: string;
}

interface PoeProcessError {
  error: string;
}

export type { PoeProcessError, PoeProcessState };
