# Implementation Plan: SES Investigation Dashboard

**Branch**: `[001-ses-investigation]` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ses-investigation/spec.md`

## Summary

Build a read-only operational dashboard for support and operations teams to
investigate AWS SES email events stored in Supabase/PostgreSQL. The solution
uses a single React + Vite frontend with TypeScript, shadcn/ui, Tailwind CSS,
TanStack Query, and a Supabase read layer. The core experience centers on a
recipient-based investigation flow, backed by a landing overview, message trace
detail, and resilient loading, empty, and error states.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18+, Vite 5+

**Primary Dependencies**: React Router, TanStack Query, Supabase JS client,
shadcn/ui, Tailwind CSS, Radix UI primitives, Vitest, React Testing Library,
Playwright

**Storage**: Supabase/PostgreSQL as the system of record; browser-local UI state
only for transient filters and view state

**Testing**: Unit and component tests with Vitest + React Testing Library;
end-to-end smoke coverage with Playwright

**Target Platform**: Modern desktop and mobile web browsers

**Project Type**: Web application

**Performance Goals**: Initial landing view should render quickly, recipient
search should feel immediate for typical operator workflows, and event detail
should remain responsive for long histories through pagination and targeted
queries

**Constraints**: Read-only access only; no event mutation flows; no AWS SES
administration; no client-side service-role secrets; data access must respect
Supabase RLS and least-privilege permissions

**Scale/Scope**: Large event tables with many messages per recipient, requiring
efficient filtering, indexed lookup paths, and pagination for deep histories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- PostgreSQL is the source of truth: PASS. All dashboard data is read from
  Supabase/PostgreSQL-derived tables or views.
- Email Investigation First: PASS. The architecture prioritizes recipient investigation, message traceability,  
  delivery diagnostics, and operational troubleshooting workflows.
- Stable data contracts: PASS. The plan uses typed query models, explicit view
  models, and dedicated mappers between raw rows and UI state.
- Least-privilege access: PASS. The browser uses only the public Supabase
  client with row-level security and no secret write credentials.
- Validate before ship: PASS. The phased plan includes unit, component, and
  end-to-end verification for search, detail, and overview flows.

## Project Structure

### Documentation (this feature)

```text
specs/001-ses-investigation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
frontend/
├── index.html
├── vite.config.ts
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── shell.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── shell/
│   │   └── states/
│   ├── features/
│   │   ├── overview/
│   │   ├── recipient-search/
│   │   ├── message-trace/
│   │   └── event-detail/
│   ├── lib/
│   │   ├── env.ts
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── queries/
│   │   └── formatters/
│   ├── styles/
│   │   └── globals.css
│   └── main.tsx
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

**Structure Decision**: Use a single `frontend/` application rather than a
separate backend service. The dashboard reads directly from Supabase, with
feature-first organization for overview, recipient investigation, and event
traceability.

## Phased Implementation

### Phase 0: Foundation and Research
- Confirm the Supabase access pattern, data shapes, and the minimum read-only
  permission model.
- Define the canonical query surfaces for landing overview, recipient
  investigation, and event detail.
- Record routing decisions and search/filter behavior in `research.md`.

### Phase 1: App Shell and Data Contracts
- Scaffold the Vite application shell, route layout, and shared providers.
- Define the data model and UI-facing types for recipient investigation and
  message traceability.
- Build the shared Supabase client, query wrappers, and row-to-view-model
  mappers.

### Phase 2: Core Investigation UX
- Implement the landing overview with recent activity and prominent search.
- Implement recipient-based investigation results with filtering and empty
  states.
- Implement event detail and message trace views for lifecycle analysis.

### Phase 3: Hardening and Validation
- Add component and e2e coverage for the core workflows.
- Tune query performance, pagination, and caching behavior.
- Polish error handling, skeletons, and empty states for operator efficiency.

## Complexity Tracking

No constitution violations require justification for this plan.
