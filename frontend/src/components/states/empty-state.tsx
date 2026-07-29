import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useI18n();

  return (
    <div className="rounded-panel border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-bold text-ink">{title || t.common.emptyTitle}</h3>
      <p className="mt-2 text-sm text-ink-muted">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
