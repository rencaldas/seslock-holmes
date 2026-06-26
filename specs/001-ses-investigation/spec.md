# Feature Specification: SES Investigation Dashboard

**Feature Branch**: `[001-ses-investigation]`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "Build a web-based dashboard application for support and operations teams. The dashboard is used to investigate AWS SES email events stored in PostgreSQL/Supabase, search for recipient activity, trace message lifecycles, identify originating applications or SMTP identities, diagnose delivery failures, and provide an operational overview of email delivery activity. The application is read-only and focused on troubleshooting workflows."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recipient Investigation (Priority: P1)

As a support or operations analyst, I want to search by recipient email address
and immediately see all related email activity so that I can quickly determine
what happened to a specific message.

**Why this priority**: Recipient-based investigation is the primary operational
workflow and the fastest path to answering delivery questions.

**Independent Test**: Enter a recipient email address and verify that the
dashboard shows all matching events, their outcomes, and the most recent
activity for that recipient without additional navigation.

**Acceptance Scenarios**:

1. **Given** a recipient with multiple email events, **When** the analyst
   searches for the recipient, **Then** the dashboard lists all matching events
   and highlights the delivery outcome for each one.
2. **Given** a recipient with no matching events, **When** the analyst searches
   for that address, **Then** the dashboard clearly states that no events were
   found.
3. **Given** the dashboard opens, **When** the analyst lands on the home view,
   **Then** recipient search and recent activity are immediately visible.

---

### User Story 2 - Message Trace Analysis (Priority: P2)

As an analyst, I want to open an individual event and trace the full lifecycle
of the message so that I can understand the origin and reason for success or
failure.

**Why this priority**: Detailed event analysis is required to explain delivery
issues after the recipient has been found.

**Independent Test**: Select a single event and verify that the dashboard shows
message origin, sender and recipient details, event outcome, and any failure or
bounce information needed to explain the result.

**Acceptance Scenarios**:

1. **Given** a selected message event, **When** the analyst opens the detail
   view, **Then** the dashboard shows the event outcome, origin, sender, and
   recipient information.
2. **Given** a failed delivery event, **When** the analyst reviews the detail
   view, **Then** the dashboard shows the technical reason and supporting failure
   metadata.
3. **Given** related events exist for the same message, **When** the analyst
   inspects the event detail, **Then** the dashboard makes the message
   progression easy to follow.

---

### User Story 3 - Operational Overview (Priority: P3)

As a support or operations analyst, I want an opening view of recent delivery
activity and problem patterns so that I can spot issues before starting a search.

**Why this priority**: An overview helps operators orient themselves and
prioritize investigations, but it does not replace recipient search.

**Independent Test**: Open the dashboard and verify that recent activity,
delivery problems, and key event patterns are visible without first running a
search.

**Acceptance Scenarios**:

1. **Given** the dashboard opens, **When** the analyst views the landing page,
   **Then** recent email activity is visible.
2. **Given** recent failures exist, **When** the analyst reviews the overview,
   **Then** the dashboard makes problem activity easy to identify.
3. **Given** the analyst is ready to investigate, **When** they move from the
   overview to a recipient search, **Then** the transition is direct and
   requires minimal navigation.

### Edge Cases

- A recipient has both successful and failed events over time.
- Multiple messages were sent to the same recipient on the same day.
- A message is delayed before later succeeding or failing.
- A message has partial metadata, such as missing origin or sender details.
- A search term is malformed or contains leading/trailing spaces.
- No recent activity is available on the landing view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-000**: The system MUST provide a web-based dashboard interface for support and operations analysts.
- **FR-001**: The system MUST let an analyst search by recipient email address.
- **FR-002**: The system MUST return all email events associated with the
  searched recipient.
- **FR-003**: The system MUST show the delivery outcome for each relevant event,
  including sent, delivered, bounced, complained, delayed, rejected, and
  rendering failure states.
- **FR-004**: The system MUST provide a landing view with recent activity and
  prominent recipient search.
- **FR-005**: The system MUST allow analysts to open an individual event and
  review the message lifecycle.
- **FR-006**: The system MUST show enough event detail to identify the message
  origin, sender information, recipient information, and failure reason when
  present.
- **FR-007**: The system MUST make related events for the same message easy to
  correlate during investigation.
- **FR-008**: The system MUST clearly indicate when no matching events are found.
- **FR-009**: The system MUST present the dashboard as read-only for event
  records.
- **FR-010**: The system MUST not include event creation, editing, deletion, or
  AWS SES configuration workflows.
- **FR-011**: The system MUST display the originating application, SMTP identity, or equivalent sender attribution information when available.
- **FR-012**: The system MUST present related events in chronological order to support message lifecycle investigation.
- **FR-013**: The system MUST allow analysts to restrict investigations to a selected time range.
- **FR-014**: The landing view MUST provide summarized visibility into recent email event activity and delivery outcomes.

### Key Entities *(include if feature involves data)*

- **Recipient**: An email address being investigated, along with the set of
  matching email events.
- **Email Event**: A single outcome record such as sent, delivered, bounced,
  complained, delayed, rejected, or rendering failure.
- **Message Trace**: The related set of events that describe the progression of
  one message across its lifecycle.
- **Origin**: The application, identity, or sender context associated with a
  message.
- **Delivery Detail**: Supporting metadata that explains the outcome, such as
  reason text, bounce details, or complaint details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A support analyst can determine the outcome of a known recipient
  investigation in a single workflow without leaving the dashboard.
- **SC-002**: A support analyst can identify the origin of a message and the
  reason for failure, when present, during the same investigation.
- **SC-003**: The landing page gives analysts immediate access to recent
  activity and recipient search without extra navigation.
- **SC-004**: Analysts can distinguish successful deliveries from bounced,
  complained, delayed, rejected, and rendering failure cases from the dashboard
  alone.
- **SC-005**: Most standard recipient investigations can be completed in under
  2 minutes by a trained support analyst.

## Assumptions

- The dashboard is used by support and operations staff who already know the
  recipient email address or can obtain it from an incident report.
- Email event records, message outcome fields, and origin metadata already exist
  in the operational datastore.
- The product is read-only and does not manage email sending, campaign setup, or
  AWS SES configuration.
- Exact email address matching is the primary investigation path, with recent
  activity provided as an orientation aid.
- Search results and event details are expected to cover the common SES outcomes
  described in the user request.
