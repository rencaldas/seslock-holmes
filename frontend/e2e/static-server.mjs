// Standalone static file server for the CSP e2e test only — not part of the
// app or its deploy. `vite preview` serves the production build but does not
// send the response headers configured in ../vercel.json (those are injected
// by Vercel's own routing layer, not by Vite), so it can never actually
// trigger a CSP violation in a browser. This server serves the same dist/
// output with those same headers attached, so the Playwright test can catch
// a real policy regression before it reaches production.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT) || 4173;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const vercelConfig = JSON.parse(await readFile(path.resolve(__dirname, "../vercel.json"), "utf8"));

// This project's vercel.json only ever has a single header rule with
// source "/(.*)" (applies to every route), so there's nothing to gain from
// a real path-to-regexp matcher here — every configured header is just
// applied to every response.
const staticHeaders = (vercelConfig.headers ?? []).flatMap((rule) => rule.headers ?? []);

async function resolveStaticFile(pathname) {
  const candidate = path.join(distDir, decodeURIComponent(pathname));
  if (!candidate.startsWith(distDir)) return null;
  try {
    const info = await stat(candidate);
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  for (const header of staticHeaders) {
    res.setHeader(header.key, header.value);
  }

  const pathname = new URL(req.url ?? "/", `http://localhost:${port}`).pathname;
  // SPA rewrite, mirroring vercel.json's "/(.*)" -> "/index.html" rule.
  const filePath = (await resolveStaticFile(pathname)) ?? path.join(distDir, "index.html");
  const contentType = MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream";

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(body);
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
}).listen(port, () => {
  console.log(`CSP-enforcing preview server ready at http://localhost:${port}`);
});
