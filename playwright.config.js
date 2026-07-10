import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__',
  testMatch: '**/*.spec.js',
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  forbidOnly: process.env.CI === 'true', // Forbid .only in CI
  retries: process.env.CI ? 2 : 0, // Retry on CI
  workers: process.env.CI ? 1 : 1, // Single worker to avoid interference
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173', // Vite dev server or local file server
    trace: 'on-first-retry', // Trace for debugging
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npx http-server -p 5173 -c-1 -o false',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/chrome-headless-shell',
      },
    },
  ],
});
