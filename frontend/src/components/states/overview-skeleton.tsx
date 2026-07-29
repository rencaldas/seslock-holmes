import { Skeleton } from "@/components/ui/skeleton";

function MetricCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-card">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className={tall ? "h-9 w-24" : "h-7 w-20"} />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-panel border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-card ${className ?? ""}`}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className="mt-6 h-48 w-full rounded-control" />
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando painel">
      <div className="rounded-panel border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <Skeleton className="h-[108px] w-[108px] rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-72">
            <Skeleton className="h-20 rounded-control" />
            <Skeleton className="h-20 rounded-control" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCardSkeleton tall />
        <MetricCardSkeleton tall />
        <MetricCardSkeleton tall />
        <MetricCardSkeleton tall />
      </div>

      <ChartCardSkeleton />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
