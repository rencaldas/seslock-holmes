import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
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
});
