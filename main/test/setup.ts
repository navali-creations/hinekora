import { afterEach, beforeEach, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { setIpcMainHandleForTests } from "~/main/utils/ipc-window-roles";

const shouldShowLogs = process.env.VITEST_SHOW_LOGS === "1";

beforeEach(() => {
  setIpcMainHandleForTests(vi.fn());

  if (shouldShowLogs) {
    return;
  }

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  DatabaseService.resetForTests();
  setIpcMainHandleForTests(null);
  vi.restoreAllMocks();
});
