import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web app for server mode: talks to the Node API over HTTP.
export default defineConfig({
  root: "src/web",
  plugins: [react()],
  define: {
    __BUGLOOP_MODE__: JSON.stringify("server"),
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
