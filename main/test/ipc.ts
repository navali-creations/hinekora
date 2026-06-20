import { afterEach, vi } from "vitest";

import { setIpcMainHandleForTests } from "~/main/utils/ipc-window-roles";

type IpcTestHandler = (event: unknown, ...args: unknown[]) => unknown;

function mockIpcMainHandlers(): {
  handle: ReturnType<typeof vi.spyOn>;
  handlers: Map<string, IpcTestHandler>;
} {
  const handlers = new Map<string, IpcTestHandler>();
  const handle = vi.fn((channel: string, listener: IpcTestHandler) => {
    handlers.set(channel, listener as IpcTestHandler);
  });

  setIpcMainHandleForTests(
    handle as Parameters<typeof setIpcMainHandleForTests>[0],
  );

  return { handle, handlers };
}

afterEach(() => {
  setIpcMainHandleForTests(null);
});

export { mockIpcMainHandlers };
