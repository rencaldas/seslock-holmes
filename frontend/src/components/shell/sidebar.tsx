import { Link, NavLink } from "react-router-dom";
import { Activity, BookOpen, CalendarClock, Search, Settings2, X } from "lucide-react";
import overviewLogo from "@/assets/overview-logo.webp";
import overviewLogoBlack from "@/assets/overview-logo-black.webp";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/use-i18n";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold transition",
    isActive ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-800",
  );

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const t = useI18n();

  const navItems = [
    { to: "/", label: t.nav.overview, icon: Activity, end: true },
    { to: "/investigate", label: t.nav.investigate, icon: Search, end: false },
    { to: "/scheduled-reports", label: t.nav.scheduledReports, icon: CalendarClock, end: false },
    { to: "/faq", label: t.nav.faq, icon: BookOpen, end: false },
    { to: "/settings", label: t.nav.settings, icon: Settings2, end: false },
  ];

  return (
    <>
      {mobileOpen ? (
        <div
          aria-hidden="true"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900",
          "lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:w-[248px] lg:translate-x-0",
          mobileOpen && "translate-x-0",
        )}
      >
        <div className="relative flex items-center justify-center gap-2 px-3 pb-3 pt-5">
          <Link to="/" onClick={onCloseMobile} className="flex items-center gap-3">
            <img src={overviewLogoBlack} alt="Seslock Holmes" className="h-14 w-14 object-contain dark:hidden" />
            <img src={overviewLogo} alt="Seslock Holmes" className="hidden h-14 w-14 object-contain dark:block" />
            <div>
              <p className="text-lg font-bold leading-tight text-ink">{t.app.subtitle}</p>
              <p className="text-xs font-medium leading-tight text-ink-muted">v{__APP_VERSION__}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={t.shell.closeMenu}
            className="absolute right-3 top-5 inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navItemClass} onClick={onCloseMobile}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">{t.app.title}</p>
        </div>
      </aside>
    </>
  );
}
