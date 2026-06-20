import { resolve } from "node:path";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const renderer = resolve(__dirname, "renderer");

export default defineConfig({
  root: renderer,
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./routes",
      generatedRouteTree: "./routeTree.gen.ts",
    }),
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      "~/main": resolve(__dirname, "./main"),
      "~/renderer": resolve(__dirname, "./renderer"),
      "~/types": resolve(__dirname, "./types"),
      "~": resolve(__dirname, "."),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: resolve(__dirname, ".vite/renderer/main_window"),
    rollupOptions: {
      input: {
        index: resolve(renderer, "index.html"),
      },
    },
  },
});
