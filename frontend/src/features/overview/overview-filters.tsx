import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EmailEventType } from "@/lib/supabase/types";

export interface OverviewFilterValues {
  windowDays: number;
  status: "all" | EmailEventType;
  origin: string;
}

export function OverviewFilters({
  value,
  onChange,
  onApply,
}: {
  value: OverviewFilterValues;
  onChange: (next: OverviewFilterValues) => void;
  onApply: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="space-y-2">
        <Label htmlFor="overview-window">Janela</Label>
        <Select
          id="overview-window"
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
        <Label htmlFor="overview-status">Status</Label>
        <Select
          id="overview-status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as OverviewFilterValues["status"] })}
          options={[
            { label: "Todos os resultados", value: "all" },
            { label: "Enviado", value: "sent" },
            { label: "Entregue", value: "delivered" },
            { label: "Bounce", value: "bounced" },
            { label: "Reclamação", value: "complained" },
            { label: "Atrasado", value: "delayed" },
            { label: "Rejeitado", value: "rejected" },
            { label: "Falha de renderização", value: "rendering_failure" },
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="overview-origin">Filtro de origem</Label>
        <Input
          id="overview-origin"
          placeholder="Aplicação ou identidade SMTP"
          value={value.origin}
          onChange={(event) => onChange({ ...value, origin: event.target.value })}
        />
      </div>
      <div className="flex items-end">
        <Button type="button" className="w-full md:w-auto" onClick={onApply}>
          Aplicar filtros
        </Button>
      </div>
    </div>
  );
}
