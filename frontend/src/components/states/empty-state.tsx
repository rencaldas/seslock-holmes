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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center shadow-soft">
      <h3 className="text-lg font-semibold text-slate-950">{title || t.common.emptyTitle}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
