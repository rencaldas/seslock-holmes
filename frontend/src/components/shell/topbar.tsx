import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HelpCircle, LogOut, Menu, Share2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalHeaderSearch } from "@/components/shell/global-header-search";
import { ShareDialog } from "@/features/dashboard-share/share-dialog";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useFilters } from "@/lib/filters/filters-context";
import { signOut } from "@/lib/supabase/auth";
import { useSupabase } from "@/lib/supabase/context";
import { useUserRole } from "@/lib/user-roles/use-user-role";

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const t = useI18n();
  const { client, session } = useSupabase();
  const { filters } = useFilters();
  const location = useLocation();
  const [shareOpen, setShareOpen] = useState(false);
  const { role } = useUserRole();
  // Só faz sentido compartilhar a Visão geral (é a única página cujos dados
  // vêm de filtros travados), só quem tem sessão pode criar links — a policy
  // de dashboard_shares exige o papel `authenticated` — e, desde o RBAC leve
  // (20260814090000), só manager pode de fato inserir a linha (viewer levaria
  // 403 da RLS; isto só evita mostrar o botão nesse caso).
  const canShare = location.pathname === "/" && Boolean(session && client) && role === "manager";

  return (
    <>
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
          {canShare ? (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label={t.dashboardShare.buttonLabel}
              title={t.dashboardShare.buttonLabel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
            >
              <Share2 className="h-4 w-4" />
            </button>
          ) : null}
          <Link
            to="/faq"
            aria-label={t.nav.faq}
            className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
          {/* Só aparece com sessão ativa: quem usa um projeto de RLS aberta
              nunca faz login, e um botão "Sair" permanente confundiria. */}
          {session && client ? (
            <button
              type="button"
              onClick={() => void signOut(client)}
              aria-label={t.login.signOut}
              title={t.login.signOut}
              className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      {/* Fora do <header>: backdrop-blur nele cria um containing block novo
          para position:fixed, o que prendia este overlay dentro da faixa de
          64px do header em vez de cobrir a tela inteira. */}
      {shareOpen ? <ShareDialog filters={filters} onClose={() => setShareOpen(false)} /> : null}
    </>
  );
}
