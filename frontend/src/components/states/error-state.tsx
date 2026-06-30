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
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-rose-900">{title ?? t.common.errorTitle}</h3>
      <p className="mt-2 text-sm text-rose-800">{description}</p>
      {onRetry ? (
        <Button className="mt-5" variant="destructive" onClick={onRetry}>
          {t.common.retry}
        </Button>
      ) : null}
    </div>
  );
}
