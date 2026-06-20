import type {
  ManagedRecorderResolution,
  ManagedRecorderSceneItemPosition,
  ManagedRecorderProperty as NoobsProperty,
} from "./ManagedRecorder.utils";

interface NoobsSignal {
  code?: number;
  error?: string;
  id?: string;
  type?: string;
}

interface NoobsApi {
  Init: (
    runtimePath: string,
    logPath: string,
    callback: (signal: NoobsSignal) => void,
  ) => void;
  SetBuffering: (enabled: boolean) => void;
  StartBuffer: () => void;
  StartRecording: (offsetSeconds: number) => void;
  StopRecording: () => void;
  ForceStopRecording: () => void;
  GetLastRecording: () => string | null;
  SetRecordingCfg?: (outputDirectory: string, container: string) => void;
  ResetVideoContext?: (fps: number, width: number, height: number) => void;
  SetVideoEncoder?: (
    encoder: string,
    settings: Record<string, string | number | boolean>,
  ) => void;
  ListVideoEncoders?: () => string[];
  CreateSource?: (name: string, type: string) => string;
  DeleteSource?: (name: string) => void;
  GetSourceSettings?: (name: string) => Record<string, unknown>;
  SetSourceSettings?: (name: string, settings: Record<string, unknown>) => void;
  GetSourceProperties?: (name: string) => NoobsProperty[];
  AddSourceToScene?: (name: string) => void;
  RemoveSourceFromScene?: (name: string) => void;
  GetSourcePos?: (
    name: string,
  ) => ManagedRecorderSceneItemPosition & ManagedRecorderResolution;
  SetSourcePos?: (
    name: string,
    position: ManagedRecorderSceneItemPosition,
  ) => void;
}

type NoobsImporter = (specifier: string) => Promise<unknown>;

/* v8 ignore start -- Vitest's VM lacks the runtime dynamic import callback. */
const importNoobsModule: NoobsImporter = (specifier) => {
  const importer = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;

  return importer(specifier);
};
/* v8 ignore stop */

async function loadNoobsApi(
  importer: NoobsImporter = importNoobsModule,
): Promise<NoobsApi | null> {
  const imported = await importer("noobs");
  const candidate =
    typeof imported === "object" && imported !== null && "default" in imported
      ? (imported as { default: unknown }).default
      : imported;

  return isNoobsApi(candidate) ? candidate : null;
}

function isNoobsApi(candidate: unknown): candidate is NoobsApi {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }

  const record = candidate as Record<string, unknown>;

  return (
    typeof record.Init === "function" &&
    typeof record.SetBuffering === "function" &&
    typeof record.StartBuffer === "function" &&
    typeof record.StartRecording === "function" &&
    typeof record.StopRecording === "function" &&
    typeof record.ForceStopRecording === "function" &&
    typeof record.GetLastRecording === "function"
  );
}

export type { NoobsApi, NoobsImporter, NoobsSignal };
export { importNoobsModule, isNoobsApi, loadNoobsApi };
