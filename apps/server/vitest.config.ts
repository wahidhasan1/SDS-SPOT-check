import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5432/fluentpath_test',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
      REVENUECAT_WEBHOOK_AUTH: 'Bearer rc-test-auth',
      REALTIME_PUBSUB: 'off',
      AUTH_RATE_LIMIT_PER_MIN: '100000',
      TURN_URLS: 'turn:turn.example.com:3478',
      TURN_SECRET: 'turn-test-secret',
    },
  },
});
