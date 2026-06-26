import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AppProviders } from "@/app/providers";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>,
);
