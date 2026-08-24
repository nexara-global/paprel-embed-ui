import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        configure: resolve(__dirname, "src/configure.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["lit", "@paprel/embed-core"],
      output: {
        entryFileNames: "[name].js",
      },
    },
    cssCodeSplit: false,
  },
});
