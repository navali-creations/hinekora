import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  closeSentry: vi.fn().mockResolvedValue(true),
  initSentry: vi.fn().mockResolvedValue(undefined),
  isPackaged: { value: false },
}));

vi.mock("~/main/modules/sentry/Sentry.reporter", () => ({
  closeSentry: sentryMocks.closeSentry,
  formatSentryErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  initSentry: sentryMocks.initSentry,
}));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return sentryMocks.isPackaged.value;
    },
  },
}));

import {
  SentryService,
  scrubBreadcrumbData,
  scrubPaths,
} from "../Sentry.service";

const RELEASE_PATTERN = expect.stringMatching(/^hinekora@\d+\.\d+\.\d+$/);

describe("SentryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.com/1");
    sentryMocks.closeSentry.mockResolvedValue(true);
    sentryMocks.initSentry.mockResolvedValue(undefined);
    sentryMocks.isPackaged.value = false;
    SentryService.resetForTests();
  });

  it("creates and reuses the singleton instance", () => {
    const first = SentryService.getInstance();
    const second = SentryService.getInstance();

    expect(first).toBe(second);

    SentryService.resetForTests();

    expect(SentryService.getInstance()).not.toBe(first);
  });

  it("initializes Sentry with release, environment, PII settings, and scrubbers", async () => {
    const service = SentryService.getInstance();

    await service.initialize();

    expect(service.isInitialized()).toBe(true);
    expect(service.isDisabled()).toBe(false);
    expect(sentryMocks.initSentry).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeBreadcrumb: expect.any(Function),
        beforeSend: expect.any(Function),
        dsn: "https://public@example.com/1",
        environment: "development",
        release: RELEASE_PATTERN,
        sendDefaultPii: false,
      }),
    );
  });

  it("uses production environment for packaged builds", async () => {
    sentryMocks.isPackaged.value = true;

    await SentryService.getInstance().initialize();

    expect(sentryMocks.initSentry).toHaveBeenCalledWith(
      expect.objectContaining({ environment: "production" }),
    );
  });

  it("deduplicates concurrent and repeated initialization", async () => {
    let resolveInit: (() => void) | undefined;
    sentryMocks.initSentry.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      }),
    );
    const service = SentryService.getInstance();
    const first = service.initialize();
    const second = service.initialize();

    expect(sentryMocks.initSentry).toHaveBeenCalledTimes(1);
    resolveInit?.();
    await Promise.all([first, second]);
    await service.initialize();

    expect(service.isInitialized()).toBe(true);
    expect(sentryMocks.initSentry).toHaveBeenCalledTimes(1);
  });

  it("stays uninitialized and can retry when initialization fails", async () => {
    sentryMocks.initSentry.mockRejectedValueOnce("SDK unavailable");
    const service = SentryService.getInstance();

    await service.initialize();

    expect(service.isInitialized()).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARN [sentry] Failed to initialize crash reporting",
      ),
      expect.objectContaining({ error: "SDK unavailable" }),
    );

    await service.initialize();

    expect(service.isInitialized()).toBe(true);
    expect(sentryMocks.initSentry).toHaveBeenCalledTimes(2);
  });

  it("disables initialized crash reporting and tolerates repeated calls", async () => {
    const service = SentryService.getInstance();

    await service.disable();
    expect(sentryMocks.closeSentry).not.toHaveBeenCalled();

    await service.initialize();
    await service.disable();
    await service.disable();

    expect(sentryMocks.closeSentry).toHaveBeenCalledTimes(1);
    expect(sentryMocks.closeSentry).toHaveBeenCalledWith(2000);
    expect(service.isInitialized()).toBe(true);
    expect(service.isDisabled()).toBe(true);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "INFO [sentry] Crash reporting disabled by user preference",
      ),
    );
  });

  it("waits for in-flight initialization before disabling", async () => {
    let resolveInit: (() => void) | undefined;
    sentryMocks.initSentry.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      }),
    );
    const service = SentryService.getInstance();
    const initializing = service.initialize();
    const disabling = service.disable();

    expect(sentryMocks.closeSentry).not.toHaveBeenCalled();

    resolveInit?.();
    await Promise.all([initializing, disabling]);

    expect(sentryMocks.closeSentry).toHaveBeenCalledWith(2000);
    expect(service.isDisabled()).toBe(true);
  });

  it("still marks Sentry disabled when closing fails", async () => {
    sentryMocks.closeSentry.mockRejectedValueOnce("close failed");
    const service = SentryService.getInstance();

    await service.initialize();
    await service.disable();

    expect(service.isDisabled()).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("WARN [sentry] Failed to close crash reporting"),
      expect.objectContaining({ error: "close failed" }),
    );
  });
});

describe("Sentry path scrubbing", () => {
  it("scrubs Windows, Unix, macOS, and multiple-path messages", () => {
    expect(
      scrubPaths(
        "ERR loading C:\\Users\\SomeUser\\AppData\\Local\\Hinekora\\index.html",
      ),
    ).toBe("ERR loading C:\\**\\Hinekora\\index.html");

    expect(scrubPaths("Error at /home/john/projects/hinekora/main.js")).toBe(
      "Error at /**/hinekora/main.js",
    );

    expect(
      scrubPaths(
        "Loading /Users/alice/Library/Application Support/Hinekora/data.db",
      ),
    ).toBe("Loading /**/Hinekora/data.db");

    const multiple = scrubPaths(
      "Opened C:\\Users\\Bob\\AppData\\Local\\Hinekora\\config.json and C:\\Users\\Bob\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt",
    );

    expect(multiple).toBe(
      "Opened C:\\**\\Hinekora\\config.json and C:\\**\\Path of Exile 2\\logs\\Client.txt",
    );
  });

  it("returns strings without paths unchanged", () => {
    expect(scrubPaths("normal message")).toBe("normal message");
    expect(scrubPaths("")).toBe("");
  });

  it("scrubs breadcrumb strings and string array items only", () => {
    const data = {
      args: [
        "C:\\Users\\SomeUser\\AppData\\Roaming\\Hinekora\\log.txt",
        "normal",
        42,
      ],
      flag: true,
      nested: { key: "value" },
      url: "file:///C:\\Users\\SomeUser\\AppData\\Local\\Hinekora\\index.html",
    };

    const result = scrubBreadcrumbData(data);

    expect(result).toEqual({
      args: ["C:\\**\\Hinekora\\log.txt", "normal", 42],
      flag: true,
      nested: { key: "value" },
      url: "file:///C:\\**\\Hinekora\\index.html",
    });
    expect(scrubBreadcrumbData({})).toEqual({});
  });
});

describe("Sentry callbacks", () => {
  let beforeSend: (event: any) => any;
  let beforeBreadcrumb: (breadcrumb: any) => any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.com/1");
    sentryMocks.closeSentry.mockResolvedValue(true);
    sentryMocks.initSentry.mockResolvedValue(undefined);
    sentryMocks.isPackaged.value = false;
    SentryService.resetForTests();

    await SentryService.getInstance().initialize();
    const [initOptions] = sentryMocks.initSentry.mock.calls[0] ?? [];
    if (!initOptions) {
      throw new Error("Sentry init options were not captured");
    }
    beforeSend = initOptions.beforeSend;
    beforeBreadcrumb = initOptions.beforeBreadcrumb;
  });

  it("scrubs exception values and stack frame paths before sending", () => {
    const event = {
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  abs_path:
                    "C:\\Users\\SomeUser\\AppData\\Local\\Hinekora\\main.js",
                  filename:
                    "C:\\Users\\SomeUser\\AppData\\Local\\Hinekora\\main.js",
                },
                { filename: "internal/node.js" },
                {},
              ],
            },
            value:
              "ERR loading C:\\Users\\SomeUser\\AppData\\Local\\Hinekora\\index.html",
          },
          {
            type: "Error",
          },
        ],
      },
    };

    const result = beforeSend(event);
    const frame = result.exception.values[0].stacktrace.frames[0];

    expect(result.exception.values[0].value).toBe(
      "ERR loading C:\\**\\Hinekora\\index.html",
    );
    expect(frame.filename).toBe("C:\\**\\Hinekora\\main.js");
    expect(frame.abs_path).toBe("C:\\**\\Hinekora\\main.js");
    expect(result.exception.values[0].stacktrace.frames[1].filename).toBe(
      "internal/node.js",
    );
    expect(result.exception.values[0].stacktrace.frames[2]).toEqual({});
    expect(result.exception.values[1]).toEqual({ type: "Error" });
  });

  it("scrubs breadcrumbs on events before sending", () => {
    const event = {
      breadcrumbs: [
        {
          data: {
            url: "file:///C:\\Users\\TestUser\\AppData\\Local\\Hinekora\\index.html",
          },
          message:
            "Database C:\\Users\\TestUser\\AppData\\Roaming\\Hinekora\\hinekora.sqlite",
        },
        {
          data: {
            url: "file:///C:\\Users\\DataOnly\\AppData\\Local\\Hinekora\\index.html",
          },
        },
        { message: "User clicked button" },
      ],
    };

    const result = beforeSend(event);

    expect(result.breadcrumbs[0].message).toBe(
      "Database C:\\**\\Hinekora\\hinekora.sqlite",
    );
    expect(result.breadcrumbs[0].data.url).toBe(
      "file:///C:\\**\\Hinekora\\index.html",
    );
    expect(result.breadcrumbs[1].data.url).toBe(
      "file:///C:\\**\\Hinekora\\index.html",
    );
    expect(result.breadcrumbs[2].message).toBe("User clicked button");
  });

  it("returns events without exception or breadcrumbs unchanged", () => {
    const event = { message: "simple message" };

    expect(beforeSend(event)).toBe(event);
  });

  it("scrubs breadcrumb messages, username parameters, and data", () => {
    const breadcrumb = {
      category: "console",
      data: {
        args: ["C:\\Users\\TestUser\\AppData\\Roaming\\Hinekora\\log.txt"],
      },
      message:
        "Loading C:\\Users\\SomeUser\\AppData\\Local\\Hinekora\\renderer.js username=seb",
    };

    const result = beforeBreadcrumb(breadcrumb);

    expect(result.message).toBe(
      "Loading C:\\**\\Hinekora\\renderer.js username=[redacted]",
    );
    expect(result.data.args).toEqual(["C:\\**\\Hinekora\\log.txt"]);
  });

  it("returns breadcrumbs without message or data unchanged", () => {
    const breadcrumb = { category: "navigation", timestamp: 123 };

    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });
});
