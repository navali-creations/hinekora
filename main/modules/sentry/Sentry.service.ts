import { app } from "electron";

import {
  closeSentry,
  formatSentryErrorMessage,
  initSentry,
} from "~/main/modules/sentry/Sentry.reporter";
import { maskPath } from "~/main/utils/mask-path";

import pkgJson from "../../../package.json" with { type: "json" };

const PATH_ANCHORS = [
  "hinekora",
  "Hinekora",
  "Path of Exile",
  "Path of Exile 2",
];

const PATH_SEGMENT = /[\w.\-()]+(?:(?: [\w.\-()]+)+(?=[/\\]))?/;
const PATH_REGEX = new RegExp(
  `(?:[A-Z]:\\\\${PATH_SEGMENT.source}(?:\\\\${PATH_SEGMENT.source})*)` +
    "|" +
    `(?:\\/(?:home|Users|tmp)(?:\\/${PATH_SEGMENT.source})+)`,
  "gi",
);

function scrubPaths(text: string): string {
  return text.replace(PATH_REGEX, (match) => maskPath(match, PATH_ANCHORS));
}

function scrubBreadcrumbData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      scrubbed[key] = scrubPaths(value);
      continue;
    }

    if (Array.isArray(value)) {
      scrubbed[key] = value.map((item) =>
        typeof item === "string" ? scrubPaths(item) : item,
      );
      continue;
    }

    scrubbed[key] = value;
  }

  return scrubbed;
}

class SentryService {
  private static instance: SentryService | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private disabled = false;

  static getInstance(): SentryService {
    SentryService.instance ??= new SentryService();
    return SentryService.instance;
  }

  static resetForTests(): void {
    SentryService.instance = null;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = initSentry({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      release: `hinekora@${pkgJson.version}`,
      environment: app.isPackaged ? "production" : "development",
      sendDefaultPii: false,

      beforeSend(event) {
        if (event.exception?.values) {
          for (const exception of event.exception.values) {
            if (exception.value) {
              exception.value = scrubPaths(exception.value);
            }

            if (exception.stacktrace?.frames) {
              for (const frame of exception.stacktrace.frames) {
                if (frame.filename) {
                  frame.filename = scrubPaths(frame.filename);
                }
                if (frame.abs_path) {
                  frame.abs_path = scrubPaths(frame.abs_path);
                }
              }
            }
          }
        }

        if (event.breadcrumbs) {
          for (const breadcrumb of event.breadcrumbs) {
            if (breadcrumb.message) {
              breadcrumb.message = scrubPaths(breadcrumb.message);
            }
            if (breadcrumb.data) {
              breadcrumb.data = scrubBreadcrumbData(
                breadcrumb.data as Record<string, unknown>,
              );
            }
          }
        }

        return event;
      },

      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.message) {
          breadcrumb.message = scrubPaths(breadcrumb.message);
          breadcrumb.message = breadcrumb.message.replace(
            /username=[^\s,)]+/g,
            "username=[redacted]",
          );
        }

        if (breadcrumb.data) {
          breadcrumb.data = scrubBreadcrumbData(
            breadcrumb.data as Record<string, unknown>,
          );
        }

        return breadcrumb;
      },
    })
      .then(() => {
        this.initialized = true;
      })
      .catch((error) => {
        console.warn(
          "[SentryService] Failed to initialize crash reporting:",
          formatSentryErrorMessage(error),
        );
      })
      .finally(() => {
        this.initializationPromise = null;
      });

    await this.initializationPromise;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public isDisabled(): boolean {
    return this.disabled;
  }

  public async disable(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    if (!this.initialized || this.disabled) {
      return;
    }

    try {
      await closeSentry(2000);
    } catch (error) {
      console.warn(
        "[SentryService] Failed to close crash reporting:",
        formatSentryErrorMessage(error),
      );
    }

    this.disabled = true;
    console.log("[SentryService] Crash reporting disabled by user preference");
  }
}

export { SentryService, scrubBreadcrumbData, scrubPaths };
