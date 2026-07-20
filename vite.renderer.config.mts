import { resolve } from "node:path";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const renderer = resolve(__dirname, "renderer");
const rendererDependencies = [
  "react-icons/cg",
  "react-icons/fa",
  "react-icons/fi",
  "react-icons/gi",
  "react-icons/hi",
  "react-icons/hi2",
  "react-icons/io",
  "react-icons/io5",
  "react-icons/md",
  "react-icons/pi",
  "react-icons/ri",
  "react-icons/tb",
  "react-icons/ti",
];

export default defineConfig(({ mode }) => ({
  root: renderer,
  envDir: __dirname,
  cacheDir: resolve(
    __dirname,
    "node_modules/.vite",
    `hinekora-renderer-${mode}`,
  ),
  optimizeDeps: {
    include: rendererDependencies,
  },
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
}));
