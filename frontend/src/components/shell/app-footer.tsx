import { useEffect, useState } from "react";
import pkg from "../../../package.json";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatDisplayDateTime, SUPABASE_SETTINGS_UPDATED_EVENT } from "@/lib/supabase/settings";

export function AppFooter() {
  const t = useI18n();
  const currentYear = new Date().getFullYear();
  const [lastUpdated, setLastUpdated] = useState<string>(() => formatDisplayDateTime(__APP_BUILD_TIME__));

  useEffect(() => {
    const refreshDisplay = () => {
      setLastUpdated(formatDisplayDateTime(__APP_BUILD_TIME__));
    };

    window.addEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, refreshDisplay);

    return () => {
      window.removeEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, refreshDisplay);
    };
  }, []);

  return (
    <footer className="border-t border-slate-200 bg-white text-ink dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-2 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.9fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t.footer.contact}</p>
            <div className="text-sm leading-7 text-slate-700 dark:text-slate-200">
              <p>Email: <a href="mailto:renato.deacaldas@gmail.com" className="text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">renato.deacaldas@gmail.com</a></p>
              <p>GitHub: <a href="https://github.com/rencaldas" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">github.com/rencaldas</a></p>
              <p>LinkedIn: <a href="https://www.linkedin.com/in/rencaldas/" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">linkedin.com/in/rencaldas</a></p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t.footer.faq}</p>
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">
              <a href="/faq" className="text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">
                {t.nav.faq}
              </a>
            </p>
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">
              <a
                href="https://github.com/rencaldas/seslock-holmes/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
              >
                {t.footer.reportBug}
              </a>
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t.footer.projectInfo}</p>
            <div className="text-sm leading-7 text-slate-700 dark:text-slate-200">
              <p>
                {t.footer.projectVersion}: <span className="font-semibold text-ink">v{pkg.version}</span>
              </p>
              <p>
                {t.footer.lastUpdated}: <span className="font-medium text-ink">{lastUpdated}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} {t.footer.copyright}
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-slate-300 hover:text-ink dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:text-white"
          >
            {t.footer.backToTop}
          </button>
        </div>
      </div>
    </footer>
  );
}
