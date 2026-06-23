import { vi } from "vitest";

interface FakeBrowserWindowOptions {
  bounds?: Electron.Rectangle;
  destroyed?: boolean;
  focused?: boolean;
  url?: string;
  visible?: boolean;
}

function createFakeBrowserWindow(options: FakeBrowserWindowOptions = {}) {
  let visible = options.visible ?? false;
  const bounds = options.bounds ?? { x: 100, y: 100, width: 360, height: 96 };

  return {
    blur: vi.fn(),
    close: vi.fn(() => {
      visible = false;
    }),
    getBounds: vi.fn(() => bounds),
    getNativeWindowHandle: vi.fn(() => {
      const buffer = Buffer.alloc(8);
      buffer.writeBigUInt64LE(1234n);
      return buffer;
    }),
    hide: vi.fn(() => {
      visible = false;
    }),
    isDestroyed: vi.fn(() => options.destroyed ?? false),
    isFocused: vi.fn(() => options.focused ?? false),
    isVisible: vi.fn(() => visible),
    loadFile: vi.fn().mockResolvedValue(undefined),
    loadURL: vi.fn().mockResolvedValue(undefined),
    moveTop: vi.fn(),
    on: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setBounds: vi.fn(),
    setContentProtection: vi.fn(),
    setFocusable: vi.fn(),
    setFullScreenable: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setOpacity: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    showInactive: vi.fn(() => {
      visible = true;
    }),
    webContents: {
      getURL: vi.fn(() => options.url ?? "app://-/recorder-overlay"),
      isDevToolsOpened: vi.fn(() => false),
      openDevTools: vi.fn(),
      send: vi.fn(),
    },
  };
}

export type { FakeBrowserWindowOptions };
export { createFakeBrowserWindow };
