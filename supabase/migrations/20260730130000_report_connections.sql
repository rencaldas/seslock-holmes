-- Registry of external Supabase projects + Gmail credentials that the
-- shared Vercel Cron (frontend/api/send-scheduled-reports.ts) processes in
-- addition to this deployment's own report_schedules table.
--
-- This is what lets ANY visitor of this site — not just its owner — get
-- real automatic recurring delivery for schedules they create against their
-- OWN Supabase project: they run the portable report_schedules migration
-- (20260730120000) on their own project, then register that project's
-- service role key + their own Gmail here via the app's "Scheduled reports"
-- page. From then on, the cron above authenticates to *their* project with
-- *their* key and emails through *their* Gmail — this deployment's owner
-- never sees their data, and they never see anyone else's.
--
-- Unlike 20260730120000, this migration is NOT meant to be copy-pasted into
-- a visitor's own Supabase project — it only needs to exist once, in the hub
-- project this app's own Vercel deployment points at (SUPABASE_URL /
-- SUPABASE_SERVICE_ROLE_KEY). Run it here, alongside 20260730140000.

create table if not exists public.report_connections (
  id uuid primary key default gen_random_uuid(),
  label text,
  -- SHA-256 hex of a random 32-byte token, generated and shown to the caller
  -- exactly once at creation time (see frontend/api/connections.ts) — never
  -- stored in recoverable form, so managing (rotating/deleting) a connection
  -- always requires proving possession of that original token.
  token_hash text not null unique,
  supabase_url text not null,
  -- Encrypted with CONNECTIONS_ENCRYPTION_KEY (AES-256-GCM, see
  -- src/lib/scheduled-reports/crypto.ts) — never stored in plaintext.
  supabase_service_role_key_encrypted text not null,
  gmail_user text not null,
  gmail_app_password_encrypted text not null,
  gmail_from_name text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_connections_active_idx
  on public.report_connections (is_active);

alter table public.report_connections enable row level security;

-- Deliberately zero policies: RLS with no policies denies every role
-- (anon, authenticated) by default. This table is only ever touched by the
-- service_role key (which bypasses RLS) inside the Vercel functions above —
-- there is no legitimate reason for a browser to query it directly, since
-- doing so would require exposing a service role key or Gmail app password
-- back to the browser that submitted it.
