import { afterEach, describe, expect, it, vi } from "vitest";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import {
  assertIpcWindowRole,
  clearIpcWindowRolesForTests,
  getIpcWindowRole,
  registerGuardedIpcHandler,
  registerIpcWindowRole,
  unregisterIpcWindowRole,
} from "./ipc-window-roles";

function createEvent(senderId?: number) {
  return typeof senderId === "number"
    ? ({ sender: { id: senderId } } as Electron.IpcMainInvokeEvent)
    : ({} as Electron.IpcMainInvokeEvent);
}

afterEach(() => {
  clearIpcWindowRolesForTests();
});

describe("ipc-window-roles", () => {
  it("registers, reads, and unregisters window roles by webContents id", () => {
    registerIpcWindowRole({ id: 42 }, WindowName.Main);

    expect(getIpcWindowRole(createEvent(42))).toBe(WindowName.Main);

    unregisterIpcWindowRole({ id: 42 });

    expect(getIpcWindowRole(createEvent(42))).toBeNull();
  });

  it("ignores invalid webContents objects and sender-less events", () => {
    registerIpcWindowRole(null, WindowName.Main);
    registerIpcWindowRole({}, WindowName.Main);
    unregisterIpcWindowRole(null);
    unregisterIpcWindowRole({});

    expect(getIpcWindowRole(createEvent())).toBeNull();
  });

  it("allows matching roles and rejects missing or mismatched sender roles", () => {
    registerIpcWindowRole({ id: 1 }, WindowName.Main);
    registerIpcWindowRole({ id: 2 }, WindowName.RecorderOverlay);

    expect(() => {
      assertIpcWindowRole(createEvent(1), [WindowName.Main], "test:channel");
    }).not.toThrow();
    expect(() => {
      assertIpcWindowRole(createEvent(2), [WindowName.Main], "test:channel");
    }).toThrow("test:channel is not available from this window");
    expect(() => {
      assertIpcWindowRole(createEvent(3), [WindowName.Main], "test:channel");
    }).toThrow("test:channel is not available from this window");
  });

  it("registers guarded IPC handlers without changing their return value", () => {
    const { handle, handlers } = mockIpcMainHandlers();
    registerIpcWindowRole({ id: 7 }, WindowName.ClipPreviewOverlay);
    const handler = vi.fn((_event: Electron.IpcMainInvokeEvent, id: string) => {
      return { id };
    });
    registerGuardedIpcHandler(
      "clips:open",
      [WindowName.ClipPreviewOverlay],
      handler,
    );
    const event = createEvent(7);

    expect(handlers.get("clips:open")?.(event, "clip-1")).toEqual({
      id: "clip-1",
    });
    expect(handler).toHaveBeenCalledWith(event, "clip-1");
    expect(handle).toHaveBeenCalledWith("clips:open", expect.any(Function));
  });

  it("allows sender-less events in tests for existing handler coverage", () => {
    expect(() => {
      assertIpcWindowRole(createEvent(), [WindowName.Main], "test:channel");
    }).not.toThrow();
  });

  it("fails fast when ipcMain.handle is unavailable", async () => {
    vi.resetModules();
    vi.doMock("electron", () => ({
      ipcMain: {},
    }));
    const module = await import("./ipc-window-roles");

    module.setIpcMainHandleForTests(null);

    expect(() => {
      module.registerGuardedIpcHandler(
        "missing:handle",
        [WindowName.Main],
        () => null,
      );
    }).toThrow("Electron ipcMain.handle is not available");
    vi.doUnmock("electron");
  });

  it("rejects IPC handle overrides outside the test runtime", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVitest = process.env.VITEST;

    try {
      vi.resetModules();
      process.env.NODE_ENV = "production";
      process.env.VITEST = "false";
      const module = await import("./ipc-window-roles");

      expect(() => {
        module.setIpcMainHandleForTests(vi.fn());
      }).toThrow("IPC test handle override is only available in tests");
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousVitest === undefined) {
        delete process.env.VITEST;
      } else {
        process.env.VITEST = previousVitest;
      }
      vi.resetModules();
    }
  });
});
