import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/use-i18n";

export function LoadingState({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const t = useI18n();

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title ?? t.common.loading}</p>
      <p className="text-sm text-slate-500">{description ?? t.common.loadingDescription}</p>
    </div>
  );
}
