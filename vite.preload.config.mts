import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "~/main": resolve(__dirname, "./main"),
      "~/renderer": resolve(__dirname, "./renderer"),
      "~/types": resolve(__dirname, "./types"),
      "~": resolve(__dirname, "."),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        format: "cjs",
        entryFileNames: "preload.js",
      },
    },
  },
});
