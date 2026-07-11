import type { FullElectronAPI } from "./preload";

declare global {
  interface Window {
    electron: FullElectronAPI;
  }
}
