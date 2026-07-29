import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({
  children,
  onRemove,
  className,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-ink-muted shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover filtro"
          className="-mr-1 rounded-full p-0.5 text-ink-muted transition hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
