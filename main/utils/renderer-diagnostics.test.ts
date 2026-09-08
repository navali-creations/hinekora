import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRendererFailureDiagnostics } from "./renderer-diagnostics";

const appLogMocks = vi.hoisted(() => ({
  createSafePathLogFields: vi.fn(() => ({
    preloadFile: "preload.js",
    preloadHash: "abc123",
  })),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("~/main/utils/app-log", () => appLogMocks);

describe("renderer-diagnostics", () => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const webContents = {
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener);
      return webContents;
    }),
  };

  beforeEach(() => {
    listeners.clear();
    vi.clearAllMocks();
  });

  it("records sanitized preload failures without logging the preload path", () => {
    registerRendererFailureDiagnostics(webContents as never, {
      logScope: "test-window",
      windowKind: "Test window",
    });

    listeners.get("preload-error")?.(
      {},
      "C:\\Users\\seb\\AppData\\preload.js",
      new Error('Could not open "C:\\Users\\seb\\secret.txt"'),
    );

    expect(appLogMocks.createSafePathLogFields).toHaveBeenCalledWith(
      "C:\\Users\\seb\\AppData\\preload.js",
      "preload",
    );
    expect(appLogMocks.logError).toHaveBeenCalledWith(
      "test-window",
      "Test window preload failed",
      {
        error: 'Could not open "[path]"',
        preloadFile: "preload.js",
        preloadHash: "abc123",
      },
    );
  });

  it("records only main-frame load failures", () => {
    registerRendererFailureDiagnostics(webContents as never, {
      logScope: "test-window",
      windowKind: "Test window",
    });
    const didFailLoad = listeners.get("did-fail-load");

    didFailLoad?.({}, -105, "NAME_NOT_RESOLVED", "https://example.com", false);
    expect(appLogMocks.logWarn).not.toHaveBeenCalled();

    didFailLoad?.({}, -3, "ERR_ABORTED", "https://example.com", true);
    expect(appLogMocks.logWarn).not.toHaveBeenCalled();

    didFailLoad?.({}, -105, "NAME_NOT_RESOLVED", "https://example.com", true);
    expect(appLogMocks.logWarn).toHaveBeenCalledWith(
      "test-window",
      "Test window renderer failed to load",
      { error: "NAME_NOT_RESOLVED", errorCode: -105 },
    );
  });
});
