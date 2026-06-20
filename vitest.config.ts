import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~/main": fileURLToPath(new URL("./main", import.meta.url)),
      "~/renderer": fileURLToPath(new URL("./renderer", import.meta.url)),
      "~/types": fileURLToPath(new URL("./types", import.meta.url)),
      "~": root,
    },
  },
});
