// End-to-end checks against the built site. Run: npm run build && npm run test:e2e
import { defineConfig } from '@playwright/test';

const PORT = 4399;
// Prefer the Chromium Playwright manages; CHROMIUM_PATH overrides it (e.g. a preinstalled browser).
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath },
  },
  webServer: {
    command: `npx astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'default',
      testIgnore: /no-webgl\.spec/,
      use: { launchOptions: { executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    },
    {
      name: 'no-webgl',
      testMatch: /no-webgl\.spec/,
      use: { launchOptions: { executablePath, args: ['--disable-webgl', '--disable-webgl2'] } },
    },
  ],
});
