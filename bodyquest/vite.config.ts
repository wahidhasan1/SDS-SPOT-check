import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode demo` produces one self-contained HTML file (dist-demo/index.html) with
// in-memory routing, suitable for sandboxed hosting or opening straight from disk.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react()],
  base: mode === 'demo' ? './' : '/',
  build: mode === 'demo' ? { outDir: 'dist-demo', emptyOutDir: true } : undefined,
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
