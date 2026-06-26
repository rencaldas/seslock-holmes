import { Button } from "@/components/ui/button";

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
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center shadow-soft">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
