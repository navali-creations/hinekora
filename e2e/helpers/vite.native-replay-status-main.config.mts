import { resolve } from "node:path";

import { defineConfig } from "vite";

import mainConfig from "../../vite.main.config.mts";

const input = resolve(__dirname, "./native-replay-status-electron-main.ts");

export default defineConfig({
  resolve: mainConfig.resolve,
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL:
      "process.env.HINEKORA_E2E_RENDERER_URL",
  },
  build: {
    emptyOutDir: false,
    outDir: resolve(__dirname, "../../.vite/e2e-native-overlays"),
    sourcemap: true,
    ssr: input,
    rollupOptions: {
      external: ["electron", "noobs"],
      output: {
        entryFileNames: "native-replay-status-main.js",
        format: "cjs",
      },
    },
  },
});
