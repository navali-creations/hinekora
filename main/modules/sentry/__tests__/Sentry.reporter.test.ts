import { describe, expect, it, vi } from "vitest";

describe("Sentry reporter", () => {
  it("lazily loads the Sentry SDK for captured exceptions and messages", async () => {
    vi.resetModules();
    const sentry = {
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      close: vi.fn(),
      init: vi.fn(),
    };
    vi.doMock("@sentry/electron/main", () => sentry);
    const reporter = await import("../Sentry.reporter");
    const error = new Error("capture failed");

    reporter.captureSentryException(error, { tags: { module: "main" } });
    reporter.captureSentryMessage("ready", { level: "info" });

    await vi.waitFor(() => {
      expect(sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { module: "main" },
      });
      expect(sentry.captureMessage).toHaveBeenCalledWith("ready", {
        level: "info",
      });
    });
  });

  it("initializes and closes the Sentry SDK", async () => {
    vi.resetModules();
    const sentry = {
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      close: vi.fn().mockResolvedValue(true),
      init: vi.fn(),
    };
    vi.doMock("@sentry/electron/main", () => sentry);
    const reporter = await import("../Sentry.reporter");
    const options = { dsn: "https://public@example.com/1" };

    await reporter.initSentry(options);
    await expect(reporter.closeSentry(10)).resolves.toBe(true);

    expect(sentry.init).toHaveBeenCalledWith(options);
    expect(sentry.close).toHaveBeenCalledWith(10);
  });

  it("logs lazy capture failures without throwing", async () => {
    vi.resetModules();
    vi.doMock("@sentry/electron/main", () => {
      throw new Error("SDK missing");
    });
    const reporter = await import("../Sentry.reporter");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reporter.captureSentryMessage("ready");

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("WARN [sentry] SDK unavailable"),
        expect.objectContaining({
          error: expect.stringContaining("error when mocking a module"),
        }),
      );
    });
  });

  it("formats SDK errors consistently", async () => {
    vi.resetModules();
    const reporter = await import("../Sentry.reporter");

    expect(reporter.formatSentryErrorMessage(new Error("boom"))).toBe("boom");
    expect(reporter.formatSentryErrorMessage("plain failure")).toBe(
      "plain failure",
    );
  });
});
