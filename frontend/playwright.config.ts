import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Só precisa "parecer" configurado: getSupabaseEnv()/getSupabaseClient()
// nunca validam o valor, e todo tráfego para eles é interceptado por
// page.route() nos specs (ver e2e/fixtures/supabase-mock.ts) — a real rede
// nunca é alcançada. Precisa ser https:// para bater com a CSP em
// enforcement (connect-src 'self' https:; ver e2e/csp-headers.spec.ts).
const DUMMY_SUPABASE_URL = "https://dummy-project.supabase.co";
const DUMMY_SUPABASE_ANON_KEY = "e2e-dummy-anon-key";

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
    //
    // The Supabase env vars must be present at `npm run build` time (Vite
    // inlines import.meta.env at build, not at serve time) — that's why they
    // are set here, on the spawned build+serve process, and not just in the
    // CI job's shell.
    command: "npm run build && node e2e/static-server.mjs",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: DUMMY_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: DUMMY_SUPABASE_ANON_KEY,
    },
  },
});
