import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    ['html', { outputFolder: 'playwright-report/html', open: 'never' }],
  ],
  use: {
    baseURL: process.env.TASKFLOW_API_URL || 'http://127.0.0.1:5000',
  },
});
