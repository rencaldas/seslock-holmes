import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lido aqui e injetado como constante para que a UI mostre a versão sem
// `import pkg from "package.json"`, que arrastava o manifesto inteiro —
// dependências, devDependencies e suas versões exatas — para dentro do bundle
// público.
const { version } = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
) as { version: string };

export default defineConfig({
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    fs: {
      // Lets the Scheduled reports setup panel import the SQL migration
      // straight from supabase/migrations (repo root, outside this Vite
      // project) via `?raw`, so it never drifts from the file that's
      // actually meant to be run.
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname)],
    },
  },
  test: {
    // e2e/ holds Playwright specs (npm run test:e2e), not Vitest ones —
    // without this, Vitest's default *.spec.ts discovery picks them up too
    // and fails, since they call Playwright's own test()/expect().
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
