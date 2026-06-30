import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/shell";
import { OverviewPage } from "@/features/overview/overview-page";
import { RecipientInvestigationPage } from "@/features/recipient-search/recipient-investigation-page";
import { EventDetailPage } from "@/features/event-detail/event-detail-page";
import { FaqPage } from "@/features/faq/faq-page";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "investigate", element: <RecipientInvestigationPage /> },
      { path: "events/:eventId", element: <EventDetailPage /> },
      { path: "faq", element: <FaqPage /> },
    ],
  },
]);
