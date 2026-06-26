import { Link, NavLink } from "react-router-dom";
import { Search, ShieldCheck, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
    isActive ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-100",
  );

export function AppHeader() {
  return (
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-soft">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Seslock Holmes
            </p>
            <h1 className="text-lg font-semibold text-slate-950">Painel de Investigação</h1>
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
