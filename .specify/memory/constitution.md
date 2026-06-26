<!--
Sync Impact Report
- Version change: template/unversioned -> 1.0.0
- Modified principles: all placeholder principles replaced with dashboard-specific principles
- Added sections: Delivery Rules; Workflow & Quality Gates
- Removed sections: none
- Templates reviewed: .specify/templates/plan-template.md (no change needed);
  .specify/templates/spec-template.md (no change needed);
  .specify/templates/tasks-template.md (no change needed)
- Follow-up TODOs: none
-->
# Dashboard Constitution

## Core Principles

### I. PostgreSQL Is the Source of Truth
The dashboard MUST read business data from Supabase/PostgreSQL and treat the
database schema as the canonical contract. Any schema change MUST be introduced
through an explicit migration, and any derived UI behavior MUST map back to a
named table, view, or query.

### II. Read-First, Safe Writes Only
The dashboard SHOULD default to read-only workflows for browsing, filtering, and
analysis. Any write path MUST be intentional, validated, and protected by clear
input constraints, confirmation where appropriate, and database-side integrity
rules.

### III. Stable Data Contracts
Every data flow between the UI and PostgreSQL MUST have a defined shape,
including required fields, optional fields, empty states, and error states.
Queries, API responses, and transformations MUST be deterministic and resilient
to nulls, pagination, and schema evolution.

### IV. Least-Privilege Access
All access to Supabase MUST use the minimum permissions required for the task.
Secrets MUST stay in environment-managed configuration, and privileged database
credentials MUST never be exposed to the client or committed to the repository.

### V. Validate Before Ship
Every change MUST be verifiable with a local or preview check that exercises the
affected dashboard flow and its data access path. Schema changes, query changes,
and access-control changes MUST include a rollback or compatibility note when a
breaking path is possible.

### VI. Email Investigation First
This dashboard exists primarily to support investigation of AWS SES email events.
The primary user workflow MUST be locating a recipient, understanding the delivery outcome of a message, and diagnosing delivery issues.
All new features SHOULD prioritize operational visibility, traceability, and troubleshooting over administrative or cosmetic functionality.
Every email event SHOULD be traceable to its originating message through a stable identifier such as messageId.

## Delivery Rules

- Features MUST be expressed as small, independently testable dashboard
  journeys.
- Database changes MUST be accompanied by the migration or SQL needed to apply
  them.
- Queries MUST be parameterized and paginated when the data volume may grow.
- The UI MUST show loading, empty, and error states for every database-backed
  screen.
- Sensitive configuration values MUST be stored outside the codebase.
- Dashboard features SHOULD support efficient investigation of email delivery events.
- Event-based screens MUST expose enough information for operators to diagnose delivery outcomes and failures.

## Workflow & Quality Gates

- Specs MUST identify the affected data model, query path, and user-facing
  outcome.
- Plans MUST call out any schema or access-control impact before implementation
  begins.
- Tasks MUST separate schema work, data access work, and UI work when they can
  be delivered independently.
- Reviews MUST confirm that the dashboard still behaves correctly against the
  current Supabase/PostgreSQL schema and access rules.

## Governance

This constitution supersedes informal habits whenever they conflict. Amendments
require a documented reason, a version bump, and a compatibility review of any
affected spec, plan, or task template. The version number MUST follow semantic
versioning: MAJOR for backward-incompatible governance changes, MINOR for new or
expanded principles, and PATCH for clarifications only. Compliance is checked
whenever a feature is specified, planned, or implemented, and unresolved
violations MUST be called out explicitly before merge.

**Version**: 1.1.0 | **Ratified**: 2026-06-25 | **Last Amended**: 2026-06-25
