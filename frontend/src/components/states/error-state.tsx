import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Algo deu errado",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-rose-900">{title}</h3>
      <p className="mt-2 text-sm text-rose-800">{description}</p>
      {onRetry ? (
        <Button className="mt-5" variant="destructive" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
