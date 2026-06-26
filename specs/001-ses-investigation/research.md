# Research: SES Investigation Dashboard

## 1. Frontend Architecture

- **Decision**: Use a single-page React application built with Vite and
  feature-oriented folders.
- **Rationale**: The product is a read-only dashboard with a narrow set of
  investigation flows, so a lightweight frontend keeps the operator experience
  fast and maintainable.
- **Alternatives considered**: A backend-for-frontend or multi-service setup was
  not chosen because the application does not need server-side mutations or
  complex orchestration.

## 2. Routing Strategy

- **Decision**: Use route-level separation for overview, recipient
  investigation, and event detail. The landing view stays at `/`, recipient
  searches open a dedicated investigation route, and event detail uses a stable
  detail route.
- **Rationale**: This keeps the primary workflow shareable and bookmarkable
  while preserving a simple landing page for rapid troubleshooting.
- **Alternatives considered**: A single monolithic page with all state in local
  components was rejected because it would make deep linking and trace review
  harder.

## 3. Data Access Layer

- **Decision**: Centralize all Supabase reads in a typed query layer under
  `src/lib/supabase/queries/`.
- **Rationale**: A single query surface keeps filtering, pagination, and
  normalization consistent across overview, investigation, and detail views.
- **Alternatives considered**: Direct component-level data fetching was rejected
  because it would duplicate transformation logic and make caching inconsistent.

## 4. Query and Filtering Strategy

- **Decision**: Use exact-match recipient lookup on a normalized email field,
  plus supporting filters for status, time range, origin, and message identity
  where helpful for large histories.
- **Rationale**: Recipient-based investigation must be fast and predictable, and
  exact lookup on normalized data supports indexed reads and stable results.
- **Alternatives considered**: Free-text search across all fields was rejected
  because it would be slower and less reliable for operational troubleshooting.

## 5. Supabase Integration

- **Decision**: Use the browser Supabase client with read-only credentials and
  row-level security.
- **Rationale**: The feature is read-only, so a client-side read layer is
  sufficient as long as access is constrained by policies.
- **Alternatives considered**: A server-side proxy was rejected because it would
  add complexity without improving the core read-only workflow.

## 6. Security and Permissions

- **Decision**: Keep secret values out of the repository, use only public
  client-safe environment variables in the browser, and rely on RLS to enforce
  data access.
- **Rationale**: This matches least-privilege guidance from the constitution and
  avoids exposing any privileged database path.
- **Alternatives considered**: Embedding elevated database credentials was
  rejected because it would violate the read-only and least-privilege
  requirements.

## 7. Performance and Scalability

- **Decision**: Load recent overview data with small result sets, paginate long
  recipient histories, and fetch event detail on demand.
- **Rationale**: Event tables can grow large, and the operator workflow should
  stay responsive even when a recipient has many related events.
- **Alternatives considered**: Loading all events into memory was rejected
  because it would not scale for large recipients or high-volume datasets.

## 8. Loading, Empty, and Error States

- **Decision**: Standardize skeletons for loading, explicit empty states for no
  results, and actionable error states for failed reads.
- **Rationale**: Support teams need immediate feedback to know whether they are
  waiting, done, or blocked by missing data.
- **Alternatives considered**: Generic spinners and silent failures were rejected
  because they slow investigation and reduce operator confidence.

## 9. Testing Strategy

- **Decision**: Validate query logic with unit tests, UI behavior with component
  tests, and the full operator workflow with end-to-end smoke tests.
- **Rationale**: The feature is workflow-driven, so confidence depends on both
  data correctness and the end-user path.
- **Alternatives considered**: Unit tests alone were rejected because they would
  not verify the end-to-end investigation flow.
