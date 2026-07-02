import { describe, expect, it } from "vitest";
import { sortRecentEvents } from "./overview";

describe("sortRecentEvents", () => {
  const events = [
    { occurredAt: "2025-01-21T12:00:00.000Z", recipientEmail: "bruno@example.com" },
    { occurredAt: "2025-01-20T12:00:00.000Z", recipientEmail: "ana@example.com" },
    { occurredAt: "2025-01-22T12:00:00.000Z", recipientEmail: "carla@example.com" },
  ];

  it("sorts by newest and oldest first", () => {
    expect(sortRecentEvents(events, "time-desc").map((event) => event.recipientEmail)).toEqual([
      "carla@example.com",
      "bruno@example.com",
      "ana@example.com",
    ]);

    expect(sortRecentEvents(events, "time-asc").map((event) => event.recipientEmail)).toEqual([
      "ana@example.com",
      "bruno@example.com",
      "carla@example.com",
    ]);
  });

  it("sorts recipients alphabetically", () => {
    expect(sortRecentEvents(events, "recipient-asc").map((event) => event.recipientEmail)).toEqual([
      "ana@example.com",
      "bruno@example.com",
      "carla@example.com",
    ]);

    expect(sortRecentEvents(events, "recipient-desc").map((event) => event.recipientEmail)).toEqual([
      "carla@example.com",
      "bruno@example.com",
      "ana@example.com",
    ]);
  });
});
