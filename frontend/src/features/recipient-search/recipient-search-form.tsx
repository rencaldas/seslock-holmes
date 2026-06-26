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
  { label: "Todos os resultados", value: "all" },
  { label: "Enviado", value: "sent" },
  { label: "Entregue", value: "delivered" },
  { label: "Bounce", value: "bounced" },
  { label: "Reclamação", value: "complained" },
  { label: "Atrasado", value: "delayed" },
  { label: "Rejeitado", value: "rejected" },
  { label: "Falha de renderização", value: "rendering_failure" },
] as const;

const searchModeOptions: Array<{ label: string; value: RecipientSearchMode }> = [
  { label: "Procurar destinatário", value: "recipient" },
  { label: "Procurar remetente", value: "sender" },
  { label: "Procurar origem", value: "origin" },
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
      className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft lg:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="search-mode">Modo de busca</Label>
        <Select
          id="search-mode"
          value={value.searchMode}
          onChange={(event) => onChange({ ...value, searchMode: event.target.value as RecipientSearchMode })}
          options={searchModeOptions}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="search-text">Email ou termo</Label>
        <Input
          id="search-text"
          placeholder={value.searchMode === "origin" ? "application-name" : "maria@exemplo.com"}
          value={value.searchText}
          onChange={(event) => onChange({ ...value, searchText: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="window-days">Janela</Label>
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
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as RecipientSearchFilters["status"] })}
          options={eventTypeOptions.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="origin">Filtro de origem</Label>
        <Input
          id="origin"
          placeholder="Aplicação ou identidade SMTP"
          value={value.origin}
          onChange={(event) => onChange({ ...value, origin: event.target.value })}
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full lg:w-auto">
          Buscar
        </Button>
      </div>
    </form>
  );
}
