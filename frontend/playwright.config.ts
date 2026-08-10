import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // e2e/static-server.mjs serves the production build with the same
    // response headers Vercel applies (see vercel.json's CSP comment) —
    // `vite preview` alone doesn't send them, so it can't catch a CSP
    // regression before deploy.
    command: "npm run build && node e2e/static-server.mjs",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
