import { Link, NavLink } from "react-router-dom";
import { Search, Activity, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import overviewLogo from "@/assets/overview-logo.png";
import pkg from "../../../package.json";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
    isActive ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
  );

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 min-h-[7.5rem] bg-transparent text-slate-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-b-[1.5rem] border border-slate-800/70 bg-slate-950/95 px-4 py-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.85)] backdrop-blur-sm transition sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src={overviewLogo} alt="Seslock Holmes logo" className="h-20 w-20 object-contain" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Seslock Holmes
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-50">Painel de Investigação</h1>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-300">
                v{pkg.version}
              </span>
            </div>
          </div>
        </Link>


        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/" className={navClass} end>
            <Activity className="h-4 w-4" />
            Visão geral
          </NavLink>
          <NavLink to="/investigate" className={navClass}>
            <Search className="h-4 w-4" />
            Investigar
          </NavLink>
          <NavLink to="/faq" className={navClass}>
            <BookOpen className="h-4 w-4" />
            FAQ
          </NavLink>
        </nav>

        <Link
          to="/investigate"
          className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 md:hidden"
        >
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Link>
      </div>
    </header>
  );
}
