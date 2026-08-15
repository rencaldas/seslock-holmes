-- RBAC leve: dois papéis para usuários autenticados (viewer / manager),
-- substituindo o "authenticated = CRUD total" flat que existia até aqui em
-- report_schedules e dashboard_shares.
--
-- Por que ninguém perde acesso no momento em que isto roda:
--
-- O cadastro é fechado (contas só existem porque um administrador as criou no
-- painel do Supabase), então toda conta que já existe hoje já era, na
-- prática, confiável com CRUD completo — é exatamente o que a policy antiga
-- ("Authenticated can manage...", de 20260801015212 e 20260802120000) dizia.
-- Rebaixar todo mundo para "viewer" no instante em que esta migration roda
-- quebraria o uso normal do time imediatamente. Por isso o backfill abaixo
-- promove toda conta já existente para "manager" ANTES de trocar as policies
-- — só contas criadas DEPOIS desta migration nascem como "viewer" por
-- padrão, até um administrador promovê-las manualmente (mesmo fluxo de hoje:
-- painel/SQL Editor do Supabase — não há UI própria de gestão de papéis
-- nesta primeira versão).
--
-- current_user_role() é SECURITY DEFINER pelo mesmo motivo de
-- get_shared_dashboard (20260802120000): user_roles em si fica sem nenhuma
-- policy (nega tudo, inclusive leitura, mesmo para authenticated) — toda
-- leitura do próprio papel passa por essa função, que só devolve o papel de
-- quem chama (auth.uid()), nunca a linha de outra pessoa.
--
-- Limitação conhecida, documentada aqui de propósito: frontend/api/schedules.ts
-- e frontend/api/run-schedule-now.ts usam o client de service role, que
-- ignora RLS por completo — este RBAC não alcança o caminho do projeto padrão
-- via ADMIN_API_TOKEN, que continua sendo o único portão ali, como já era.
--
-- report_schedule_runs fica de fora de propósito: nunca teve policy de
-- escrita para authenticated (só select) — todo INSERT ali vem do
-- service-role client em report-runner.ts, que ignora RLS de qualquer forma.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'manager')) default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
-- Nenhuma policy: nega tudo, inclusive para authenticated. Acesso só através
-- de current_user_role() abaixo.

create or replace function public.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  found_role text;
begin
  select role into found_role from public.user_roles where user_id = auth.uid();
  return coalesce(found_role, 'viewer');
end;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;
-- "revoke ... from public" sozinho NÃO basta neste projeto: o Supabase
-- concede EXECUTE a anon/authenticated diretamente (não via PUBLIC) no
-- momento em que a função é criada, via ALTER DEFAULT PRIVILEGES já
-- configurado no schema public. Confirmado com has_function_privilege('anon',
-- 'public.current_user_role()', 'execute') retornando true mesmo depois do
-- revoke acima — só um revoke explícito de anon resolve.
revoke execute on function public.current_user_role() from anon;

comment on function public.current_user_role() is
  'Papel (viewer/manager) do usuario autenticado atual. SECURITY DEFINER de proposito: user_roles nao tem nenhuma policy, entao esta funcao e o unico jeito de ler o proprio papel — nunca expoe a linha de outra pessoa.';

-- Backfill: promove toda conta já existente para manager ANTES de trocar as
-- policies abaixo — ver nota no topo do arquivo.
insert into public.user_roles (user_id, role)
select id, 'manager' from auth.users
on conflict (user_id) do nothing;

-- report_schedules: leitura continua liberada para todo autenticado (viewer
-- também precisa ver o que existe); escrita passa a exigir manager.
drop policy if exists "Authenticated can manage report schedules" on public.report_schedules;

create policy "Authenticated can view report schedules"
  on public.report_schedules
  for select
  to authenticated
  using (true);

create policy "Managers can insert report schedules"
  on public.report_schedules
  for insert
  to authenticated
  with check (public.current_user_role() = 'manager');

create policy "Managers can update report schedules"
  on public.report_schedules
  for update
  to authenticated
  using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

create policy "Managers can delete report schedules"
  on public.report_schedules
  for delete
  to authenticated
  using (public.current_user_role() = 'manager');

-- dashboard_shares: mesmo split. Sem policy de DELETE (igual à tabela
-- original — revogação sempre foi soft-delete via UPDATE revoked_at, nunca
-- DELETE); a policy antiga "for all" tecnicamente permitia DELETE a qualquer
-- authenticated mesmo a UI nunca chamando isso — este split fecha esse
-- excedente de propósito, não é uma regressão de uso real.
drop policy if exists "Authenticated can manage dashboard shares" on public.dashboard_shares;

create policy "Authenticated can view dashboard shares"
  on public.dashboard_shares
  for select
  to authenticated
  using (true);

create policy "Managers can insert dashboard shares"
  on public.dashboard_shares
  for insert
  to authenticated
  with check (public.current_user_role() = 'manager');

create policy "Managers can update dashboard shares"
  on public.dashboard_shares
  for update
  to authenticated
  using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- created_by nunca foi de fato preenchido (sem default na coluna, e o insert
-- do app em createDashboardShare não manda o campo) — este trigger força o
-- valor real do autor no momento da escrita, ignorando qualquer coisa que o
-- cliente tente mandar em created_by (a policy "with check" acima não
-- protege esse campo especificamente, então a trigger é o que garante que
-- ninguém forje a autoria de outra pessoa).
--
-- Cobre INSERT e UPDATE de propósito: um trigger só de INSERT deixaria a
-- policy "Managers can update dashboard shares" (using/with check só sobre o
-- papel de quem chama, sem tocar em created_by) livre para qualquer manager
-- reescrever created_by de uma linha já existente via
-- PATCH .../dashboard_shares?id=eq.<id> com {"created_by": "<outro-uuid>"} —
-- forjando a autoria de um link que não criou. No UPDATE, em vez de
-- reatribuir para quem está editando (que rebaixaria a garantia a "última
-- pessoa que mexeu", não "quem criou"), o trigger preserva o valor original.
create or replace function public.dashboard_shares_set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists dashboard_shares_before_insert on public.dashboard_shares;
create trigger dashboard_shares_before_write
  before insert or update on public.dashboard_shares
  for each row
  execute function public.dashboard_shares_set_created_by();

-- Função só para uso interno do trigger — ninguém deveria conseguir chamá-la
-- via RPC (/rest/v1/rpc/dashboard_shares_set_created_by). O disparo do
-- trigger em si não depende de EXECUTE concedido a quem faz o INSERT, então
-- revogar de todo mundo aqui não quebra a própria trigger. Mesmo motivo do
-- revoke explícito de anon acima: "from public" sozinho não é suficiente.
revoke execute on function public.dashboard_shares_set_created_by() from public, anon, authenticated;
