import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OverviewFilters } from "@/features/overview/overview-filters";
import type { EmailEventType, RecipientSearchMode } from "@/lib/supabase/types";

export interface RecipientSearchFilters {
  searchText: string;
  searchMode: RecipientSearchMode;
  windowDays: number;
  status: "all" | EmailEventType;
  origin: string;
}

export function RecipientSearchForm({
  value,
  onChange,
  onSubmit,
}: {
  value: RecipientSearchFilters;
  onChange: (next: RecipientSearchFilters) => void;
  onSubmit: () => void;
}) {
  const { isOpen: filtersOpen, toggle: toggleFilters } = useDisclosure(false);

  return (
    <form
      className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/95 shadow-soft"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
        <Label htmlFor="search-text" className="sr-only">Email ou termo</Label>
        <Input
          id="search-text"
          placeholder={value.searchMode === "origin" ? "application-name" : "maria@exemplo.com"}
          value={value.searchText}
          onChange={(event) => onChange({ ...value, searchText: event.target.value })}
          className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
        />
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            className="w-full lg:w-auto border border-slate-500/60 bg-slate-950 text-white hover:bg-slate-900"
          >
            Buscar
          </Button>
          <Button type="button" variant="secondary" onClick={toggleFilters}>
            {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
          </Button>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-200 ease-out ${filtersOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
        <OverviewFilters
          value={value}
          onChange={(next) => onChange({ ...value, ...next })}
          onApply={onSubmit}
          className="bg-slate-950/95 border-slate-700"
          inputClassName="bg-slate-950 text-slate-100 border-slate-700 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20"
          selectClassName="bg-slate-950 text-slate-100 border-slate-700 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20"
          labelClassName="text-slate-300"
        />
      </div>
    </form>
  );
}
