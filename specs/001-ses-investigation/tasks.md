# Tasks: SES Investigation Dashboard

**Input**: Design documents from `/specs/001-ses-investigation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story so the dashboard can be built and validated in vertical slices.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel if it touches different files and has no dependency on incomplete tasks
- **[Story]**: `US1`, `US2`, `US3`
- Include exact file paths in each task description

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the frontend application, shared tooling, and baseline project structure

- [X] T001 Create the Vite frontend scaffold and root project files in `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, and `frontend/index.html`
- [X] T002 Set up Tailwind CSS and global styling in `frontend/src/styles/globals.css` and `frontend/tailwind.config.ts`
- [X] T003 Configure shadcn/ui component foundation and shared UI primitives in `frontend/src/components/ui/`
- [X] T004 Add environment loading helpers and Supabase environment validation in `frontend/src/lib/env.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared application shell and data access primitives that all user stories depend on

**Critical**: No user story work should begin until this phase is complete

- [X] T005 Create the application shell, providers, and router entry points in `frontend/src/main.tsx`, `frontend/src/app/providers.tsx`, `frontend/src/app/router.tsx`, and `frontend/src/app/shell.tsx`
- [X] T006 Set up the Supabase browser client in `frontend/src/lib/supabase/client.ts`
- [X] T007 Define shared Supabase query types and row-to-view-model helpers in `frontend/src/lib/supabase/types.ts` and `frontend/src/lib/supabase/queries/`
- [X] T008 Add shared loading, empty, and error state components in `frontend/src/components/states/`
- [X] T009 Establish shared layout components for navigation, header, and content framing in `frontend/src/components/shell/`

**Checkpoint**: The dashboard shell is ready and feature-specific work can begin

---

## Phase 3: User Story 1 - Recipient Investigation (Priority: P1) MVP

**Goal**: Allow an analyst to search by recipient email address and immediately review all related SES events

**Independent Test**: Enter a recipient email address and confirm the dashboard returns all matching events, shows delivery outcomes, and handles no-result cases clearly

### Implementation for User Story 1

- [X] T010 [US1] Build the landing overview route and recipient search entry point in `frontend/src/features/overview/` and `frontend/src/app/router.tsx`
- [X] T011 [P] [US1] Implement recipient search form and normalization behavior in `frontend/src/features/recipient-search/`
- [X] T012 [P] [US1] Implement recipient investigation query logic and caching in `frontend/src/lib/supabase/queries/recipient-investigation.ts`
- [X] T013 [US1] Render recipient search results with outcome badges, sort order, and empty state handling in `frontend/src/features/recipient-search/`
- [X] T014 [US1] Connect the landing view to recent activity and primary recipient search in `frontend/src/features/overview/`

**Checkpoint**: User Story 1 is independently usable as the MVP investigation flow

---

## Phase 4: User Story 2 - Message Trace Analysis (Priority: P2)

**Goal**: Let an analyst open a message and understand the full lifecycle, origin, and failure context

**Independent Test**: Open an event from recipient results and verify the dashboard shows origin, sender, recipient, lifecycle progression, and detailed failure metadata when present

### Implementation for User Story 2

- [X] T015 [P] [US2] Define message trace query shapes and correlation helpers in `frontend/src/lib/supabase/queries/message-trace.ts`
- [X] T016 [US2] Build the event detail route and trace layout in `frontend/src/features/event-detail/` and `frontend/src/app/router.tsx`
- [X] T017 [P] [US2] Implement message trace timeline and lifecycle progression components in `frontend/src/features/message-trace/`
- [X] T018 [US2] Render detailed event metadata panels for origin, sender, recipient, bounce, complaint, delay, rejection, and rendering failure details in `frontend/src/features/event-detail/`

**Checkpoint**: Message-level investigation is fully traceable from a recipient result

---

## Phase 5: User Story 3 - Operational Overview (Priority: P3)

**Goal**: Give operators a fast landing page with recent activity and problem patterns before they search

**Independent Test**: Open the app and confirm recent activity, delivery patterns, and problem summaries are visible without first running a search

### Implementation for User Story 3

- [X] T019 [P] [US3] Implement recent activity and summary query logic in `frontend/src/lib/supabase/queries/overview.ts`
- [X] T020 [US3] Build overview summary cards and recent activity list in `frontend/src/features/overview/`
- [X] T021 [P] [US3] Add overview filters for time window, status, and origin in `frontend/src/features/overview/`
- [X] T022 [US3] Wire overview states for loading, empty, and error conditions in `frontend/src/features/overview/` and `frontend/src/components/states/`

**Checkpoint**: The landing page provides operational context before investigation begins

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improve resilience, performance, and operator usability across the dashboard

- [X] T023 Tighten keyboard navigation, focus states, and accessible labels in `frontend/src/components/` and `frontend/src/features/`
- [X] T024 Optimize query pagination, caching defaults, and result size limits in `frontend/src/lib/supabase/queries/`
- [X] T025 Harmonize error messaging and retry affordances across shared states in `frontend/src/components/states/`
- [X] T026 Update validation guidance and workflow notes in `specs/001-ses-investigation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies, can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion and blocks all user stories
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 completion, but can proceed after US1 if the routing shell is already in place
- **Phase 5 (US3)**: Depends on Phase 2 completion and can proceed in parallel with US1 or US2 once the shared shell is ready
- **Phase 6 (Polish)**: Depends on completion of the desired user stories

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other user stories, serves as the MVP
- **User Story 2 (P2)**: Depends on the shared shell and query layer, but not on any mutation workflow
- **User Story 3 (P3)**: Depends on the shared shell and overview data access, but remains independent of trace detail work

### Within Each User Story

- Shared primitives before story-specific UI
- Query helpers before component wiring
- Route registration before deep-linked detail screens
- Loading, empty, and error states before final polish

### Parallel Opportunities

- `T011` and `T012` can run in parallel once the shared shell exists
- `T015` and `T017` can run in parallel after the base trace query shape is agreed
- `T019` and `T021` can run in parallel because they touch different overview files

---

## Parallel Example: User Story 1

```text
Task: "Implement recipient search form and normalization behavior in `frontend/src/features/recipient-search/`"
Task: "Implement recipient investigation query logic and caching in `frontend/src/lib/supabase/queries/recipient-investigation.ts`"
```

## Parallel Example: User Story 2

```text
Task: "Define message trace query shapes and correlation helpers in `frontend/src/lib/supabase/queries/message-trace.ts`"
Task: "Implement message trace timeline and lifecycle progression components in `frontend/src/features/message-trace/`"
```

## Parallel Example: User Story 3

```text
Task: "Implement recent activity and summary query logic in `frontend/src/lib/supabase/queries/overview.ts`"
Task: "Add overview filters for time window, status, and origin in `frontend/src/features/overview/`"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the recipient investigation workflow end to end
5. Ship or demo the MVP before adding deeper trace and overview polish

### Incremental Delivery

1. Build the shared shell and data layer
2. Deliver recipient investigation as the first usable slice
3. Add message trace analysis for deeper diagnosis
4. Add the operational overview for faster triage
5. Finish with resilience, accessibility, and performance hardening

### Parallel Team Strategy

1. One developer can own the shared shell and data access
2. A second developer can build recipient investigation after the foundation lands
3. A third developer can prepare message trace and overview details in parallel once routes and data contracts are in place

---

## Notes

- [P] tasks are safe to parallelize when they touch different files and do not
  depend on incomplete work
- Keep the dashboard read-only throughout all phases
- Prefer small, focused tasks that map cleanly to one file or one feature slice
