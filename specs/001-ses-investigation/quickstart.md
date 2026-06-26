# Quickstart: SES Investigation Dashboard

## Purpose

Validate the read-only investigation workflow end to end: open the dashboard,
search by recipient, inspect message trace detail, and confirm operational
overview behavior.

## Prerequisites

- A Supabase project with SES event data available in PostgreSQL.
- Read-only environment variables configured for the browser client.
- A local Node.js toolchain compatible with the Vite app.
- Work from the `frontend/` directory for install, development, and validation
  commands.

## Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_EVENTS_TABLE` (optional, defaults to `ses_email_events`)

## Setup

```bash
cd frontend
npm install
npm run dev
```

## Validation Commands

```bash
cd frontend
npm run typecheck
npm run build
```

## Validation Scenarios

### 1. Landing Overview

1. Open the app in a browser.
2. Confirm the landing view shows recent activity and prominent recipient
   search.
3. Confirm loading, empty, and error states are visually distinct.

**Expected outcome**: The dashboard opens directly into an operator-friendly
overview without requiring navigation.

### 2. Recipient Investigation

1. Enter a known recipient email address.
2. Confirm the dashboard returns all matching SES events.
3. Confirm the delivery outcome is visible for each result.
4. Apply any available filters to narrow the result set.

**Expected outcome**: A support analyst can answer whether the recipient's mail
was delivered, bounced, complained, delayed, rejected, or otherwise failed.

### 3. Message Trace Detail

1. Open one event from the recipient results.
2. Confirm the detail view shows origin, sender, recipient, and message outcome.
3. Confirm failure details appear when the event did not succeed.
4. Confirm related events for the same message are easy to follow.

**Expected outcome**: The operator can reconstruct the message lifecycle without
leaving the dashboard.

### 4. Read-Only Behavior

1. Try to locate any create, edit, or delete flow for events.
2. Confirm the app does not expose SES administration workflows.

**Expected outcome**: The dashboard is clearly read-only and focused on
investigation only.

## Verification Notes

- Keep recipient searches exact after normalization.
- Use a dataset with at least one successful delivery and one failure case.
- Exercise a long recipient history to confirm pagination or incremental loading.
- If the app cannot connect, confirm the `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` values are present in the local environment.
