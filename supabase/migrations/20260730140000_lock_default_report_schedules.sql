-- Closes the "any anonymous visitor of this deployment's default site can
-- write straight into MY report_schedules table" hole from 20260730120000.
--
-- That migration deliberately keeps `report_schedules`/`report_schedule_runs`
-- open to the `anon` role — that's the right call for a visitor's OWN
-- Supabase project (their own data, their own risk to accept), but wrong for
-- THIS deployment's own project: its anon key ships inside the public JS
-- bundle, so "anon can manage report schedules" there really means "anyone
-- who loads this site, with no login, can create schedules that get emailed
-- through this project owner's own Gmail account".
--
-- Run it once, only on the Supabase project this app's own Vercel deployment
-- points at. It is NOT meant to be copy-pasted into a visitor's own project:
-- there the browser manages schedules directly with that project's own anon
-- key, and running this would break it.
--
-- After this runs, managing schedules on the *default* project only works
-- through frontend/api/schedules.ts, gated by ADMIN_API_TOKEN — the browser
-- can no longer read or write report_schedules there with the anon key.
-- Automatic sending (the cron) and "force run" still work as before, since
-- both already use the service_role key, which bypasses RLS entirely.

drop policy if exists "Anon can manage report schedules" on public.report_schedules;
drop policy if exists "Anon can read report schedule runs" on public.report_schedule_runs;

-- No replacement policies: RLS with zero policies denies every role except
-- service_role.
