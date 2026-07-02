// @vitest-environment jsdom
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { OverviewFilters } from "./overview-filters";

vi.mock("@/lib/i18n/use-i18n", () => ({
  useI18n: () => ({
    overview: {
      originPlaceholder: "Application or SMTP identity",
      filters: {
        time: "Time",
        timeModeOptions: {
          window: "Quick range",
          custom: "Custom range",
        },
        status: "Status",
        origin: "Origin filter",
        provider: "Provider",
        providerPlaceholder: "@example.com",
        startDateTime: "Start date and time",
        endDateTime: "End date and time",
        recentActivitySort: "Sort recent activity",
        recentActivitySortOptions: {
          timeDesc: "Newest first",
          timeAsc: "Oldest first",
          recipientAsc: "Recipient A-Z",
          recipientDesc: "Recipient Z-A",
        },
        clear: "Clear filters",
        apply: "Apply filters",
        options: {
          all: "All",
          sent: "Sent",
          delivered: "Delivered",
          bounced: "Bounced",
          complained: "Complaint",
          delayed: "Delayed",
          rejected: "Rejected",
          rendering_failure: "Rendering failure",
        },
        timeOptions: {
          d1: "Last 24 hours",
          d7: "Last 7 days",
          d30: "Last 30 days",
          d90: "Last 90 days",
        },
      },
    },
  }),
}));

describe("OverviewFilters", () => {
  it("shows the clear button and calls the handler", () => {
    const onClear = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <OverviewFilters
            value={{
              timeMode: "window",
              windowDays: 7,
              startAt: "",
              endAt: "",
              recentActivitySort: "time-desc",
              status: "all",
              origin: "",
              provider: "",
            }}
            onChange={() => undefined}
            onApply={() => undefined}
            onClear={onClear}
          />,
        );
      });

      const clearButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Clear filters");
      expect(clearButton).toBeTruthy();

      act(() => {
        clearButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(onClear).toHaveBeenCalledTimes(1);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
