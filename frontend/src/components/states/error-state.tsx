import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  const t = useI18n();

  return (
    <div className="rounded-panel border border-danger/20 bg-danger-soft p-6">
      <h3 className="text-lg font-bold text-danger">{title ?? t.common.errorTitle}</h3>
      <p className="mt-2 text-sm text-danger/90">{description}</p>
      {onRetry ? (
        <Button className="mt-5" variant="destructive" onClick={onRetry}>
          {t.common.retry}
        </Button>
      ) : null}
    </div>
  );
}
