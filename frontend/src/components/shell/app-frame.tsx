import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/app-header";
import { AppFooter } from "@/components/shell/app-footer";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto max-w-7xl flex-1 px-4 pt-6 pb-8 sm:px-6 lg:px-8">{children}</main>
      <AppFooter />
    </div>
  );
}
