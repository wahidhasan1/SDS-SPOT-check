import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Single-file demo: the API runs inside the page against an in-memory store.
export default defineConfig({
  root: "src/demo",
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  define: {
    __BUGLOOP_MODE__: JSON.stringify("demo"),
  },
  build: {
    outDir: "../../dist/demo",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 5000,
  },
});
