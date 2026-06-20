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
    mainFields: ["module", "jsnext:main", "jsnext"],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["noobs"],
      output: {
        format: "cjs",
        entryFileNames: "main.js",
      },
    },
  },
});
