-- Scheduled email reports: lets any Seslock Holmes user configure recurring
-- report deliveries (filters + recipients + frequency) straight from the app.
--
-- This migration is written to be portable: paste it into the SQL Editor of
-- ANY Supabase project used with this app (or run it via `supabase db push`
-- after `supabase link`). It only depends on extensions Supabase enables by
-- default (pgcrypto for gen_random_uuid()).
--
-- It intentionally does NOT enable pg_cron/pg_net or schedule the cron job
-- that invokes the edge function — those steps embed project-specific values
-- (function URL, service role key) and are generated for you, ready to copy,
-- in the app's "Scheduled reports" > "Setup" panel.

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  -- Snapshot of the events table to query: the app resolves this per-browser
  -- from local settings/env, which the edge function (running outside the
  -- browser) can't see, so each schedule carries its own copy.
  events_table text not null default 'aws_sns',
  -- Subset of OverviewFilterValues: { windowDays, status, origin, subject,
  -- provider, rowLimit, sortBy }. Deliberately excludes timeMode/startAt/endAt
  -- (absolute custom ranges) since a recurring job only makes sense with a
  -- relative window like "last 7 days", recomputed on every run.
  filters jsonb not null default '{}'::jsonb,
  recipients text[] not null default '{}',
  -- { type: 'daily'|'weekly'|'monthly', time: 'HH:mm', dayOfWeek?: 0-6, dayOfMonth?: 1-31 }
  frequency jsonb not null,
  timezone text not null default 'America/Sao_Paulo',
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('success', 'error')),
  last_run_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_schedules_frequency_type_check
    check (frequency ->> 'type' in ('daily', 'weekly', 'monthly')),
  constraint report_schedules_recipients_not_empty
    check (array_length(recipients, 1) > 0)
);

create table if not exists public.report_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.report_schedules(id) on delete cascade,
  generated_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  error_message text,
  -- The full EmailReport object (summary/categories/recipients/query/...)
  -- produced by that run, so the app can re-render it and regenerate
  -- CSV/PDF/JSON on demand without storing any binary files.
  report jsonb,
  recipients_sent text[],
  created_at timestamptz not null default now()
);

create index if not exists report_schedule_runs_schedule_id_idx
  on public.report_schedule_runs (schedule_id, generated_at desc);

create index if not exists report_schedules_due_idx
  on public.report_schedules (next_run_at)
  where is_active;

-- Centralizes "when does this run next" math in SQL (timezone/DST-safe via
-- `AT TIME ZONE`) so the browser (schedule creation) and the edge function
-- (after each run) never have to duplicate this logic in JS/Deno.
create or replace function public.compute_next_run_at(
  frequency jsonb,
  tz text,
  from_ts timestamptz default now()
) returns timestamptz
language plpgsql
as $$
declare
  freq_type text := frequency ->> 'type';
  freq_time text := coalesce(frequency ->> 'time', '00:00');
  target_hour int := split_part(freq_time, ':', 1)::int;
  target_minute int := split_part(freq_time, ':', 2)::int;
  target_dow int := coalesce((frequency ->> 'dayOfWeek')::int, 0);
  target_dom int := coalesce((frequency ->> 'dayOfMonth')::int, 1);
  local_now timestamp := from_ts at time zone tz;
  candidate timestamp;
  days_ahead int;
  month_start date;
  days_in_month int;
  clamped_day int;
begin
  candidate := date_trunc('day', local_now) + make_interval(hours => target_hour, mins => target_minute);

  if freq_type = 'daily' then
    if candidate <= local_now then
      candidate := candidate + interval '1 day';
    end if;

  elsif freq_type = 'weekly' then
    days_ahead := (target_dow - extract(dow from candidate)::int + 7) % 7;
    candidate := candidate + make_interval(days => days_ahead);
    if candidate <= local_now then
      candidate := candidate + interval '7 days';
    end if;

  elsif freq_type = 'monthly' then
    month_start := date_trunc('month', local_now)::date;
    days_in_month := extract(day from (month_start + interval '1 month - 1 day'))::int;
    clamped_day := least(target_dom, days_in_month);
    candidate := month_start + (clamped_day - 1) * interval '1 day'
      + make_interval(hours => target_hour, mins => target_minute);

    if candidate <= local_now then
      month_start := (date_trunc('month', local_now) + interval '1 month')::date;
      days_in_month := extract(day from (month_start + interval '1 month - 1 day'))::int;
      clamped_day := least(target_dom, days_in_month);
      candidate := month_start + (clamped_day - 1) * interval '1 day'
        + make_interval(hours => target_hour, mins => target_minute);
    end if;

  else
    raise exception 'Unknown frequency type: %', freq_type;
  end if;

  return candidate at time zone tz;
end;
$$;

create or replace function public.report_schedules_set_next_run_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_active then
    new.next_run_at := public.compute_next_run_at(new.frequency, new.timezone, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists report_schedules_before_write on public.report_schedules;
create trigger report_schedules_before_write
  before insert or update of frequency, timezone, is_active
  on public.report_schedules
  for each row
  execute function public.report_schedules_set_next_run_at();

alter table public.report_schedules enable row level security;
alter table public.report_schedule_runs enable row level security;

-- Same open trust model as the rest of the app (no user login; the anon key
-- itself is the access boundary) — schedules are managed straight from the
-- browser, so anon needs full CRUD here. Run history is anon-readable so the
-- "Scheduled reports" page can show it, but only the edge function (using the
-- service role key, which bypasses RLS) ever writes a run row.
drop policy if exists "Anon can manage report schedules" on public.report_schedules;
create policy "Anon can manage report schedules"
  on public.report_schedules
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Anon can read report schedule runs" on public.report_schedule_runs;
create policy "Anon can read report schedule runs"
  on public.report_schedule_runs
  for select
  to anon
  using (true);
