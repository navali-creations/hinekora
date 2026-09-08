import { resolve } from "node:path";

import { defineConfig } from "vite";

import mainConfig from "../../vite.main.config.mts";

const input = resolve(
  __dirname,
  "./native-overlay-devtools-electron-main.ts",
);

export default defineConfig({
  resolve: mainConfig.resolve,
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: "undefined",
    MAIN_WINDOW_VITE_NAME: JSON.stringify("main_window"),
  },
  build: {
    emptyOutDir: false,
    outDir: resolve(__dirname, "../../.vite/e2e-native-overlays"),
    sourcemap: true,
    ssr: input,
    rollupOptions: {
      external: ["electron", "noobs"],
      output: {
        entryFileNames: "native-overlay-devtools-main.js",
        format: "cjs",
      },
    },
  },
});
