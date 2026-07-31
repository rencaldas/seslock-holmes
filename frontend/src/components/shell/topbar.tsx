import { Link } from "react-router-dom";
import { HelpCircle, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalHeaderSearch } from "@/components/shell/global-header-search";
import { useI18n } from "@/lib/i18n/use-i18n";

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const t = useI18n();

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

      <div className="min-w-0 flex-1">
        <GlobalHeaderSearch />
      </div>

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
