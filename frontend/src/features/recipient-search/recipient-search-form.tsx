import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EmailEventType, RecipientSearchMode } from "@/lib/supabase/types";

export interface RecipientSearchFilters {
  searchText: string;
  searchMode: RecipientSearchMode;
  windowDays: number;
  status: "all" | EmailEventType;
  origin: string;
}

const eventTypeOptions = [
  { label: "Todos", value: "all" },
  { label: "Enviado", value: "sent" },
  { label: "Entregue", value: "delivered" },
  { label: "Bounce", value: "bounced" },
  { label: "Reclamação", value: "complained" },
  { label: "Atrasado", value: "delayed" },
  { label: "Rejeitado", value: "rejected" },
  { label: "Falha de renderização", value: "rendering_failure" },
] as const;

const searchModeOptions: Array<{ label: string; value: RecipientSearchMode }> = [
  { label: "Destinatário", value: "recipient" },
  { label: "Remetente", value: "sender" },
  { label: "Origem", value: "origin" },
];

export function RecipientSearchForm({
  value,
  onChange,
  onSubmit,
}: {
  value: RecipientSearchFilters;
  onChange: (next: RecipientSearchFilters) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="group overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/95 shadow-soft"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2 p-4 sm:grid-cols-[1fr]">
        <Label htmlFor="search-text" className="sr-only">Email ou termo</Label>
        <Input
          id="search-text"
          placeholder={value.searchMode === "origin" ? "application-name" : "maria@exemplo.com"}
          value={value.searchText}
          onChange={(event) => onChange({ ...value, searchText: event.target.value })}
          className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
        />
      </div>

      <div className="overflow-hidden max-h-0 opacity-0 transition-all duration-200 ease-out group-hover:max-h-[1200px] group-hover:opacity-100">
        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="search-mode" className="text-slate-300">Modo de busca</Label>
            <Select
              id="search-mode"
              value={value.searchMode}
              onChange={(event) => onChange({ ...value, searchMode: event.target.value as RecipientSearchMode })}
              options={searchModeOptions}
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="window-days" className="text-slate-300">Tempo</Label>
            <Select
              id="window-days"
              value={String(value.windowDays)}
              onChange={(event) => onChange({ ...value, windowDays: Number(event.target.value) })}
              options={[
                { label: "Últimas 24 horas", value: "1" },
                { label: "Últimos 7 dias", value: "7" },
                { label: "Últimos 30 dias", value: "30" },
                { label: "Últimos 90 dias", value: "90" },
              ]}
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status" className="text-slate-300">Status</Label>
            <Select
              id="status"
              value={value.status}
              onChange={(event) => onChange({ ...value, status: event.target.value as RecipientSearchFilters["status"] })}
              options={eventTypeOptions.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="origin" className="text-slate-300">Filtro de origem</Label>
            <Input
              id="origin"
              placeholder="Identidade SMTP"
              value={value.origin}
              onChange={(event) => onChange({ ...value, origin: event.target.value })}
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full lg:w-auto border border-slate-500/60 bg-slate-950 text-white hover:bg-slate-900"
            >
              Buscar
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
