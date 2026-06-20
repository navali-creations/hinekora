import { type CSSProperties, useEffect, useState } from "react";

import { useManagedRecorderShallow } from "~/renderer/store";

type CountdownStyle = CSSProperties & {
  "--digits": number;
  "--value": number;
};

interface ElapsedTime {
  hours: number;
  minutes: number;
  seconds: number;
}

function RecordingStatus() {
  const { isRunActive, startedAt } = useManagedRecorderShallow(
    (managedRecorder) => {
      const status = managedRecorder.status;

      return {
        isRunActive: status?.runRecordingActive === true,
        startedAt:
          status?.runRecordingStartedAt ?? status?.recordingStartedAt ?? null,
      };
    },
  );
  const [now, setNow] = useState(() => Date.now());
  const elapsedTime = getElapsedTime(startedAt, now);

  useEffect(() => {
    setNow(Date.now());

    if (!startedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, [startedAt]);

  return (
    <div className="preview p-3 pl-5 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-base-content/50">
            Recording
          </div>
          <div className="mb-2 font-semibold text-base-content">
            {isRunActive ? "Run active" : "Active"}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-base-content/60">
              Duration
            </div>
            <span className="inline-flex items-center gap-1.5">
              <div className="flex flex-col items-center gap-0.5">
                <span className="countdown font-mono text-base tabular-nums">
                  <span style={createCountdownStyle(elapsedTime.hours)} />
                </span>
                <span className="text-[9px] uppercase tracking-tight text-base-content/50">
                  hrs
                </span>
              </div>
              <span className="pb-[14px] text-sm text-base-content/50">:</span>
              <div className="flex flex-col items-center gap-0.5">
                <span className="countdown font-mono text-base tabular-nums">
                  <span style={createCountdownStyle(elapsedTime.minutes)} />
                </span>
                <span className="text-[9px] uppercase tracking-tight text-base-content/50">
                  min
                </span>
              </div>
              <span className="pb-[14px] text-sm text-base-content/50">:</span>
              <div className="flex flex-col items-center gap-0.5">
                <span className="countdown font-mono text-base tabular-nums">
                  <span style={createCountdownStyle(elapsedTime.seconds)} />
                </span>
                <span className="text-[9px] uppercase tracking-tight text-base-content/50">
                  sec
                </span>
              </div>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function createCountdownStyle(value: number): CountdownStyle {
  return {
    "--digits": 2,
    "--value": value,
  };
}

function getElapsedTime(
  referenceTime: string | null,
  nowMs: number,
): ElapsedTime {
  if (!referenceTime) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }

  const referenceMs = new Date(referenceTime).getTime();

  if (!Number.isFinite(referenceMs)) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.max(0, Math.floor((nowMs - referenceMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds };
}

export { RecordingStatus };
