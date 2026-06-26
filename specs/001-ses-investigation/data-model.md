# Data Model: SES Investigation Dashboard

## Recipient Investigation

Represents the operator's search context for a recipient email address.

### Fields

- `recipientEmail`: Normalized email address used for exact lookup.
- `searchTerm`: Raw user-entered value.
- `matchCount`: Number of related events found.
- `latestEventAt`: Timestamp of the newest event for that recipient.
- `hasProblemActivity`: Boolean summary for failed or delayed activity.
- `investigationWindowStart`: Start of the selected investigation period.
- `investigationWindowEnd`: End of the selected investigation period.

### Rules

- Recipient lookup is based on exact match after normalization.
- A recipient investigation may return zero or many events.
- Investigation results may be restricted to a selected time window.

## Email Event

Represents one SES-related event captured for a message and recipient.

### Fields

- `eventId`: Stable unique identifier.
- `messageId`: Identifier used to correlate related lifecycle events.
- `recipientEmail`: Recipient tied to the event.
- `eventType`: Original SES event classification (for example: send, delivery, bounce, complaint, delivery delay, reject, or rendering failure).
- `deliveryStatus`: Operational outcome used by the dashboard for investigation and reporting.
- `occurredAt`: Timestamp of the event.
- `originApp`: Application or system that originated the message.
- `smtpIdentity`: Identity or sending context associated with the message.
- `senderEmail`: Sender address shown in the event.
- `recipientInfo`: Recipient metadata captured with the event.
- `deliveryStatus`: Outcome summary for quick scanning.
- `failureReason`: Human-readable explanation when the event failed.
- `bounceDetails`: Bounce-specific metadata when applicable.
- `complaintDetails`: Complaint-specific metadata when applicable.
- `delayDetails`: Delay-specific metadata when applicable.
- `rejectionDetails`: Rejection-specific metadata when applicable.
- `renderingFailureDetails`: Rendering failure metadata when applicable.
- `metadata`: Additional trace metadata needed for investigation.

### Rules

- Each event belongs to exactly one message trace.
- Some fields are optional and appear only for specific event types.
- The event list is ordered newest-first by default.

## Message Trace

Represents the correlated lifecycle of one message across all related events.

### Fields

- `messageId`: Shared identifier across related events.
- `recipientEmail`: Primary recipient for the trace.
- `events`: Ordered list of lifecycle events.
- `finalOutcome`: Latest meaningful outcome for the message.
- `traceSummary`: Short operational summary for the investigator.

### Rules

- A trace is derived from the set of events that share the same message
  correlation key.
- The trace should make it easy to move from send to final outcome.

## Overview Metric

Represents a high-level operational summary shown on the landing page.

### Fields

- `windowStart`: Start of the reporting window.
- `windowEnd`: End of the reporting window.
- `totalEvents`: Total number of events in the selected period.
- `deliveredEvents`: Count of successful delivery events.
- `bouncedEvents`: Count of bounce events.
- `complaintEvents`: Count of complaint events.
- `problemEvents`: Count of bounced, complained, delayed, rejected, and rendering failure events.
- `topOrigins`: Optional ranking of sources with the most activity.

### Rules

- Overview metrics are derived from the same event dataset as the detailed views.
- Overview output must remain lightweight enough for the landing page.
