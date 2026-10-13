import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://fluent:fluent_dev_pw@localhost:5432/fluent_test',
      RATE_LIMIT: 'false',
      ALLOW_DEV_SUBSCRIPTIONS: 'true',
      ANTHROPIC_API_KEY: '',
      UPLOAD_DIR: '.data/test-uploads',
    },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
