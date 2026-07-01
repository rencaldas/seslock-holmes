import { useEffect, useState } from "react";
import pkg from "../../../package.json";
import { useI18n } from "@/lib/i18n/use-i18n";
import {
  formatDisplayDateTime,
  getRefreshIntervalMs,
  SUPABASE_SETTINGS_UPDATED_EVENT,
} from "@/lib/supabase/settings";

export function AppFooter() {
  const t = useI18n();
  const currentYear = new Date().getFullYear();
  const [lastUpdated, setLastUpdated] = useState<string>(t.common.noAvailableData);

  useEffect(() => {
    let isCancelled = false;

    async function loadLatestCommit() {
      try {
        const response = await fetch("https://api.github.com/repos/rencaldas/seslock-holmes/commits?per_page=1", {
          headers: { Accept: "application/vnd.github+json" },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch latest commit");
        }

        const [commit] = await response.json();
        const commitDate = commit?.commit?.committer?.date ?? commit?.commit?.author?.date;

        if (!commitDate) {
          throw new Error("Missing commit date");
        }

        if (!isCancelled) {
          setLastUpdated(formatDisplayDateTime(commitDate));
        }
      } catch {
        if (!isCancelled) {
          setLastUpdated(formatDisplayDateTime(new Date()));
        }
      }
    }

    const refreshDisplay = () => {
      void loadLatestCommit();
    };

    refreshDisplay();

    const intervalId = window.setInterval(refreshDisplay, getRefreshIntervalMs());
    window.addEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, refreshDisplay);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, refreshDisplay);
    };
  }, []);

  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-2 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.9fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t.footer.contact}</p>
            <div className="text-sm leading-7 text-slate-200">
              <p>Email: <a href="mailto:renato.deacaldas@gmail.com" className="text-sky-300 hover:text-sky-200">renato.deacaldas@gmail.com</a></p>
              <p>GitHub: <a href="https://github.com/rencaldas" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200">github.com/rencaldas</a></p>
              <p>LinkedIn: <a href="https://www.linkedin.com/in/rcaldas/" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200">linkedin.com/in/rcaldas</a></p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t.footer.faq}</p>
            <p className="text-sm leading-7 text-slate-200">
              <a href="/faq" className="text-sky-300 hover:text-sky-200">
                {t.nav.faq}
              </a>
            </p>
            <p className="text-sm leading-7 text-slate-200">
              <a
                href="https://github.com/rencaldas/seslock-holmes/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 hover:text-sky-200"
              >
                {t.footer.reportBug}
              </a>
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t.footer.projectInfo}</p>
            <div className="text-sm leading-7 text-slate-200">
              <p>
                {t.footer.projectVersion}: <span className="font-semibold text-slate-100">v{pkg.version}</span>
              </p>
              <p>
                {t.footer.lastUpdated}: <span className="font-medium text-slate-100">{lastUpdated}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-800 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} {t.footer.copyright}
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:text-white"
          >
            {t.footer.backToTop}
          </button>
        </div>
      </div>
    </footer>
  );
}
