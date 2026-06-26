import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/app-header";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
