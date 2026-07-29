import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HelpCircle, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { normalizeEmail } from "@/lib/formatters/email";
import { useI18n } from "@/lib/i18n/use-i18n";

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const t = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeEmail(query);
    if (!normalized) {
      return;
    }
    navigate(`/investigate?query=${encodeURIComponent(normalized)}&mode=recipient`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-10 dark:border-slate-800 dark:bg-slate-950/85">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label={t.shell.openMenu}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <form onSubmit={handleSubmit} className="flex w-full min-w-0 max-w-sm items-center">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.overview.searchPlaceholder}
            aria-label={t.overview.investigateRecipient}
            className="h-9 w-full rounded-control border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 dark:border-slate-700 dark:bg-slate-900 dark:focus:bg-slate-900"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Link
          to="/faq"
          aria-label={t.nav.faq}
          className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
        >
          <HelpCircle className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
