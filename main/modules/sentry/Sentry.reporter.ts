import { logWarn } from "~/main/utils/app-log";

type SentryModule = typeof import("@sentry/electron/main");
type CaptureExceptionArgs = Parameters<SentryModule["captureException"]>;
type CaptureMessageArgs = Parameters<SentryModule["captureMessage"]>;
type InitArgs = Parameters<SentryModule["init"]>;
type CloseArgs = Parameters<SentryModule["close"]>;

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

function captureSentryMessage(...args: CaptureMessageArgs): void {
  reportWithSentry((Sentry) => Sentry.captureMessage(...args));
}

async function initSentry(...args: InitArgs): Promise<void> {
  const Sentry = await loadSentryModule();
  Sentry.init(...args);
}

async function closeSentry(...args: CloseArgs): Promise<boolean> {
  const Sentry = await loadSentryModule();
  return Sentry.close(...args);
}

export {
  captureSentryException,
  captureSentryMessage,
  closeSentry,
  formatSentryErrorMessage,
  initSentry,
};
