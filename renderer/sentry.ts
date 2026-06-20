import * as Sentry from "@sentry/electron/renderer";

let initialized = false;

function initSentry(enabled = true): void {
  if (!enabled) {
    console.info("[Sentry] Crash reporting disabled by user preference");
    return;
  }

  if (initialized) {
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    beforeBreadcrumb(breadcrumb) {
      if (
        breadcrumb.category === "console" &&
        breadcrumb.message?.includes("username=")
      ) {
        breadcrumb.message = breadcrumb.message.replace(
          /username=[^\s,)]+/g,
          "username=[redacted]",
        );
      }

      return breadcrumb;
    },
  });

  initialized = true;
}

function resetSentryForTests(): void {
  initialized = false;
}

export { initSentry, resetSentryForTests };
