# Acceptance Checklist: SES Investigation Dashboard

**Purpose**: Confirm the feature satisfies the intended operational workflow
**Created**: 2026-06-25
**Feature**: [spec.md](../spec.md)

## Recipient-Based Investigation

- [x] Operators can start from the landing view and search by recipient email
- [x] A recipient search returns all relevant matching email events
- [x] Search results make delivery outcome visible at a glance
- [x] The dashboard makes it easy to answer whether a message was delivered or failed

## Message Traceability

- [x] Operators can open an individual event for deeper investigation
- [x] Event detail includes message origin, sender, recipient, and outcome
- [x] Failure cases surface enough technical detail to explain the issue
- [x] Related events for the same message can be correlated during review

## Operational Readiness

- [x] Recent activity is visible when the dashboard opens
- [x] Problem activity is easy to identify from the overview
- [x] The product is read-only for event records
- [x] AWS SES administration and email authoring are out of scope

## Notes

- Checklist items are marked complete based on the current spec assumptions and
  user-provided scope.
