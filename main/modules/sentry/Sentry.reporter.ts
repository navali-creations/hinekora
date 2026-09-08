import { logWarn } from "~/main/utils/app-log";

type SentryModule = typeof import("@sentry/electron/main");
type CaptureExceptionArgs = Parameters<SentryModule["captureException"]>;
type InitArgs = Parameters<SentryModule["init"]>;

let sentryModulePromise: Promise<SentryModule> | null = null;

function loadSentryModule(): Promise<SentryModule> {
  sentryModulePromise ??= import("@sentry/electron/main");
  return sentryModulePromise;
}

function logSentryLoadFailure(error: unknown): void {
  logWarn("sentry", "SDK unavailable", {
    error: formatSentryErrorMessage(error),
  });
}

function formatSentryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function reportWithSentry(callback: (sentry: SentryModule) => void): void {
  void loadSentryModule().then(callback).catch(logSentryLoadFailure);
}

function captureSentryException(...args: CaptureExceptionArgs): void {
  reportWithSentry((Sentry) => Sentry.captureException(...args));
}

async function initSentry(options: InitArgs[0]): Promise<void> {
  const Sentry = await loadSentryModule();
  Sentry.init({ ...options, ipcMode: Sentry.IPCMode.Classic });
}

export { captureSentryException, formatSentryErrorMessage, initSentry };
