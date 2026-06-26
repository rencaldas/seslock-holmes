import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({
  title = "Carregando",
  description = "Buscando os dados mais recentes do SES.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}
