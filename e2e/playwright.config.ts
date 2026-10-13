import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:5173',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [
        '--use-fake-ui-for-media-stream', // auto-accept the microphone permission prompt
        '--use-fake-device-for-media-stream', // synthetic microphone (a continuous tone)
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
});
