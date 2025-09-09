import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Shadow Tagger Extension E2E tests
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Extensions need sequential testing
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension testing
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    headless: false, // Extensions require headed mode
    baseURL: 'https://example.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'Chrome Extension',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
    }
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm run build:dev',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
});