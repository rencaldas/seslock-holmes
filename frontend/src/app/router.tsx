import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/shell";
import { LoadingState } from "@/components/states/loading-state";

const OverviewPage = lazy(() =>
  import("@/features/overview/overview-page").then((m) => ({ default: m.OverviewPage })),
);
const RecipientInvestigationPage = lazy(() =>
  import("@/features/recipient-search/recipient-investigation-page").then((m) => ({
    default: m.RecipientInvestigationPage,
  })),
);
const EventDetailPage = lazy(() =>
  import("@/features/event-detail/event-detail-page").then((m) => ({ default: m.EventDetailPage })),
);
const FaqPage = lazy(() => import("@/features/faq/faq-page").then((m) => ({ default: m.FaqPage })));
const SettingsPage = lazy(() =>
  import("@/features/settings/settings-page").then((m) => ({ default: m.SettingsPage })),
);
const ScheduledReportsPage = lazy(() =>
  import("@/features/scheduled-reports/scheduled-reports-page").then((m) => ({
    default: m.ScheduledReportsPage,
  })),
);
const SharedDashboardPage = lazy(() =>
  import("@/features/dashboard-share/shared-dashboard-page").then((m) => ({
    default: m.SharedDashboardPage,
  })),
);

// Cada rota é seu próprio chunk (React.lazy), carregado só quando visitado —
// sem isso o bundle inicial trazia todas as páginas (Recharts incluso) de
// uma vez só, mesmo pra quem abre direto a Overview.
function lazyRoute(node: ReactNode) {
  return <Suspense fallback={<LoadingState />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  // Fora do AppShell de propósito: quem abre um link compartilhado não tem
  // sessão nem Configurações salvas, então nem a checagem de credenciais nem
  // o gate de login (ambos dentro de AppShell) fazem sentido aqui — a página
  // resolve sua própria conexão a partir dos parâmetros da URL.
  { path: "share/:token", element: lazyRoute(<SharedDashboardPage />) },
  {
    element: <AppShell />,
    children: [
      { index: true, element: lazyRoute(<OverviewPage />) },
      { path: "investigate", element: lazyRoute(<RecipientInvestigationPage />) },
      { path: "events/:eventId", element: lazyRoute(<EventDetailPage />) },
      { path: "scheduled-reports", element: lazyRoute(<ScheduledReportsPage />) },
      { path: "faq", element: lazyRoute(<FaqPage />) },
      { path: "settings", element: lazyRoute(<SettingsPage />) },
    ],
  },
]);
