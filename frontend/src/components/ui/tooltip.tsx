import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIDE_CLASSES: Record<"top" | "bottom", string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
};

export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex cursor-help items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {children}
      </span>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute z-50 w-max max-w-[240px] rounded-control bg-ink px-3 py-2 text-xs font-medium leading-snug text-white shadow-hover dark:bg-slate-100 dark:text-ink",
            SIDE_CLASSES[side],
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
