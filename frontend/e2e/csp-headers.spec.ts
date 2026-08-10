// Runs against the production build served with the real vercel.json
// headers (see e2e/static-server.mjs) — visits every top-level route and
// fails if the enforced Content-Security-Policy blocked anything the app
// needed.
//
// Detection combines two signals:
//  - the `securitypolicyviolation` DOM event, the spec'd API fired for every
//    CSP violation (https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent)
//    — this is the reliable source of truth, verified against this exact
//    Chromium build (Chrome for Testing 149) by temporarily setting
//    script-src to 'none' and confirming it fires.
//  - console error text, as a second signal. Verified wording from that same
//    Chromium build: "...violates the following Content Security Policy
//    directive..." (space, no hyphen — the hyphenated "Content-Security-Policy"
//    only appears as the HTTP header name, never in the browser's own
//    message) and "has been blocked" rather than "Refused to" (an older
//    Chrome/Firefox wording kept here too, in case a browser/version still
//    uses it).
import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/investigate",
  "/events/01234567-89ab-cdef-0123-456789abcdef",
  "/scheduled-reports",
  "/faq",
  "/settings",
  "/share/example-share-token",
];

const CONSOLE_MARKERS = ["content security policy", "refused to"];

declare global {
  interface Window {
    __cspViolations: string[];
  }
}

for (const route of ROUTES) {
  test(`no CSP violations on ${route}`, async ({ page }) => {
    const violations: string[] = [];

    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__cspViolations.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
      });
    });

    page.on("console", (message) => {
      const text = message.text();
      if (CONSOLE_MARKERS.some((marker) => text.toLowerCase().includes(marker))) {
        violations.push(text);
      }
    });
    page.on("pageerror", (error) => {
      if (CONSOLE_MARKERS.some((marker) => error.message.toLowerCase().includes(marker))) {
        violations.push(error.message);
      }
    });

    await page.goto(route, { waitUntil: "load" });
    // Gives late console messages (async chunk loads, deferred fetches) a
    // chance to arrive before we check what was captured.
    await page.waitForTimeout(1000);

    const domViolations = await page.evaluate(() => window.__cspViolations);
    violations.push(...domViolations);

    expect(violations, `Violações de CSP em ${route}:\n${violations.join("\n")}`).toEqual([]);
  });
}
