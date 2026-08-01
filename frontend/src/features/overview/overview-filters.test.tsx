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
        title: "Filters",
        time: "Time",
        timeModeOptions: {
          window: "Quick range",
          custom: "Custom range",
        },
        status: "Status",
        bounceSubtype: "Bounce type",
        bounceSubtypeOptions: {
          all: "All",
          suppressed: "Suppressed",
          general: "General failure",
          mailboxFull: "Mailbox full",
          contentRejected: "Content rejected",
          undetermined: "Undetermined",
        },
        origin: "Origin filter",
        subject: "Subject Filter",
        provider: "Provider",
        providerPlaceholder: "@example.com",
        rows: "Rows",
        noRowLimit: "No limit",
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
              bounceSubType: "all",
              origin: "",
              subject: "",
              provider: "",
              rowLimit: 100,
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

  it("keeps every field label on a single line and renders the rows selector alongside subject/provider", () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <OverviewFilters
            value={{
              timeMode: "window",
              windowDays: 30,
              startAt: "",
              endAt: "",
              recentActivitySort: "time-desc",
              status: "all",
              bounceSubType: "all",
              origin: "",
              subject: "",
              provider: "",
              rowLimit: 100,
            }}
            onChange={onChange}
            onApply={onApply}
            showProviderFilter
          />,
        );
      });

      const rowLimit = container.querySelector<HTMLSelectElement>("#overview-row-limit");
      const provider = container.querySelector<HTMLInputElement>("#overview-provider");
      const subject = container.querySelector<HTMLInputElement>("#overview-subject");

      expect(rowLimit).toBeTruthy();
      expect(provider).toBeTruthy();
      expect(subject).toBeTruthy();

      // Regression guard: the "Rows" label used to wrap onto two lines and
      // fall out of alignment with the rest of the filter row.
      const rowsLabel = container.querySelector('label[for="overview-row-limit"]');
      expect(rowsLabel?.className).toContain("whitespace-nowrap");

      expect(Array.from(rowLimit?.options ?? []).map((option) => option.textContent)).toContain("No limit");

      act(() => {
        if (rowLimit) {
          rowLimit.value = "500";
          rowLimit.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rowLimit: 500 }));
      expect(onApply).not.toHaveBeenCalled();

      act(() => {
        if (rowLimit) {
          rowLimit.value = "all";
          rowLimit.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rowLimit: "all" }));

      const applyButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Apply filters",
      );
      act(() => {
        applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(onApply).toHaveBeenCalledOnce();
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("only shows the bounce subtype selector when status is bounced, and reports its value", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const baseValue = {
      timeMode: "window" as const,
      windowDays: 7,
      startAt: "",
      endAt: "",
      recentActivitySort: "time-desc" as const,
      status: "all" as const,
      bounceSubType: "all" as const,
      origin: "",
      subject: "",
      provider: "",
      rowLimit: 100 as const,
    };

    try {
      act(() => {
        root.render(
          <OverviewFilters value={baseValue} onChange={onChange} onApply={() => undefined} />,
        );
      });

      expect(container.querySelector("#overview-bounce-subtype")).toBeNull();

      act(() => {
        root.render(
          <OverviewFilters
            value={{ ...baseValue, status: "bounced" }}
            onChange={onChange}
            onApply={() => undefined}
          />,
        );
      });

      const bounceSubtype = container.querySelector<HTMLSelectElement>("#overview-bounce-subtype");
      expect(bounceSubtype).toBeTruthy();
      expect(Array.from(bounceSubtype?.options ?? []).map((option) => option.value)).toEqual([
        "all",
        "Suppressed",
        "General",
        "MailboxFull",
        "ContentRejected",
        "Undetermined",
      ]);

      act(() => {
        if (bounceSubtype) {
          bounceSubtype.value = "MailboxFull";
          bounceSubtype.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bounceSubType: "MailboxFull" }));
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
