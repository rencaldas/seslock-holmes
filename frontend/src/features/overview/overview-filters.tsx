import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
  className,
  inputClassName,
  selectClassName,
  labelClassName,
}: {
  value: OverviewFilterValues;
  onChange: (next: OverviewFilterValues) => void;
  onApply: () => void;
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn(
      "grid gap-4 rounded-3xl border border-slate-700 bg-slate-950/95 p-5 shadow-soft md:grid-cols-[1fr_1fr_1fr_auto]",
      className,
    )}>
      <div className="space-y-2">
        <Label htmlFor="overview-window" className={cn("text-slate-300", labelClassName)}>Tempo</Label>
        <Select
          id="overview-window"
          value={String(value.windowDays)}
          onChange={(event) => onChange({ ...value, windowDays: Number(event.target.value) })}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            selectClassName,
          )}
          options={[
            { label: "Últimas 24 horas", value: "1" },
            { label: "Últimos 7 dias", value: "7" },
            { label: "Últimos 30 dias", value: "30" },
            { label: "Últimos 90 dias", value: "90" },
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="overview-status" className={cn("text-slate-300", labelClassName)}>Status</Label>
        <Select
          id="overview-status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as OverviewFilterValues["status"] })}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            selectClassName,
          )}
          options={[
            { label: "Todos", value: "all" },
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
        <Label htmlFor="overview-origin" className={cn("text-slate-300", labelClassName)}>Filtro de origem</Label>
        <Input
          id="overview-origin"
          placeholder="Aplicação ou identidade SMTP"
          value={value.origin}
          onChange={(event) => onChange({ ...value, origin: event.target.value })}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-4 text-sm outline-none",
            "placeholder:text-slate-500 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20",
            inputClassName,
          )}
        />
      </div>
      <div className="flex items-end">
        <Button
          type="button"
          className="w-full md:w-auto border border-slate-500/60 bg-slate-950 text-white hover:bg-slate-900"
          onClick={onApply}
        >
          Aplicar filtros
        </Button>
      </div>
    </div>
  );
}
