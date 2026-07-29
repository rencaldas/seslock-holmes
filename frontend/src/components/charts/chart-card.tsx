import type { ReactNode } from "react";
import { SectionHeader } from "@/components/metrics/section-header";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col rounded-panel border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900", className)}>
      <SectionHeader title={title} description={description} action={action} />
      <div className="mt-6 flex-1">{children}</div>
    </div>
  );
}
