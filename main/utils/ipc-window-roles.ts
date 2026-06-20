import { type IpcMainInvokeEvent, ipcMain } from "electron";

import type { WindowName } from "~/main/modules/main-window/MainWindow.types";

type IpcWindowRole = WindowName;

type WebContentsLike = {
  id?: number;
};

type IpcMainHandle = (
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
) => void;

const windowRoles = new Map<number, IpcWindowRole>();
const isVitestRuntime =
  process.env.VITEST === "true" || process.env.NODE_ENV === "test";
let ipcMainHandleForTests: IpcMainHandle | null = null;

function registerIpcWindowRole(
  webContents: WebContentsLike | null | undefined,
  role: IpcWindowRole,
): void {
  if (typeof webContents?.id !== "number") {
    return;
  }

  windowRoles.set(webContents.id, role);
}

function unregisterIpcWindowRole(
  webContents: WebContentsLike | null | undefined,
): void {
  if (typeof webContents?.id !== "number") {
    return;
  }

  windowRoles.delete(webContents.id);
}

function clearIpcWindowRolesForTests(): void {
  windowRoles.clear();
}

function setIpcMainHandleForTests(handle: IpcMainHandle | null): void {
  if (!isVitestRuntime) {
    throw new Error("IPC test handle override is only available in tests");
  }

  ipcMainHandleForTests = handle;
}

function getIpcWindowRole(
  event: IpcMainInvokeEvent | { sender?: WebContentsLike } | null | undefined,
): IpcWindowRole | null {
  const senderId = event?.sender?.id;
  if (typeof senderId !== "number") {
    return null;
  }

  return windowRoles.get(senderId) ?? null;
}

function assertIpcWindowRole(
  event: IpcMainInvokeEvent | { sender?: WebContentsLike } | null | undefined,
  allowedRoles: readonly IpcWindowRole[],
  channel: string,
): void {
  if (isVitestRuntime && !event?.sender) {
    return;
  }

  const role = getIpcWindowRole(event);
  if (role && allowedRoles.includes(role)) {
    return;
  }

  throw new Error(`${channel} is not available from this window`);
}

function registerGuardedIpcHandler<Args extends unknown[], Result>(
  channel: string,
  allowedRoles: readonly IpcWindowRole[],
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Result,
): void {
  const handle =
    ipcMainHandleForTests ??
    (ipcMain as typeof ipcMain | undefined)?.handle?.bind(ipcMain);

  if (!handle) {
    throw new Error("Electron ipcMain.handle is not available");
  }

  handle(channel, (event, ...args) => {
    assertIpcWindowRole(event, allowedRoles, channel);
    return handler(event, ...(args as Args));
  });
}

export type { IpcWindowRole };
export {
  assertIpcWindowRole,
  clearIpcWindowRolesForTests,
  getIpcWindowRole,
  registerGuardedIpcHandler,
  registerIpcWindowRole,
  setIpcMainHandleForTests,
  unregisterIpcWindowRole,
};
