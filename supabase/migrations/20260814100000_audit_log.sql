-- Log de auditoria, append-only, para as ações administrativas que hoje não
-- deixam nenhum rastro: criar/editar/pausar/retomar/excluir agendamento de
-- relatório, forçar um envio, execução do cron, criar/revogar link de
-- dashboard compartilhado.
--
-- Por que não existe nenhuma policy de insert/update/delete para
-- authenticated: a tabela precisa resistir a quem já tem acesso de manager —
-- ninguém deve conseguir editar ou apagar o próprio rastro pela API. As duas
-- únicas portas de entrada são:
--   1) record_audit_event(...) abaixo — SECURITY DEFINER, usada pelo caminho
--      direto-Supabase do navegador (queries.ts / dashboard-shares/queries.ts),
--      onde auth.uid() é real;
--   2) inserts diretos com o client de service role dentro de
--      frontend/api/schedules.ts, frontend/api/run-schedule-now.ts e
--      report-runner.ts — caminho que já ignora RLS por natureza.
--
-- PII: metadata NUNCA deve conter e-mail de destinatário. Esta tabela é
-- legível por todo authenticated, inclusive um futuro viewer (RBAC de
-- 20260814090000) que não tem acesso de escrita a report_schedules — se o
-- log expusesse a lista de destinatários de cada agendamento, um viewer
-- enxergaria via esta tabela exatamente o dado que a RLS de report_schedules
-- foi desenhada pra esconder dele. Guardar só contagens/metadados não
-- sensíveis (nome do agendamento, tipo de frequência, contagem de
-- destinatários) — nunca o array de e-mails em si. Mesmo cuidado que
-- dashboard_shares.include_recent_activity já aplica para atividade recente.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null,
  actor_type text not null check (actor_type in ('user', 'admin_token', 'cron')),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc, id desc);

alter table public.audit_log enable row level security;

create policy "Authenticated can view audit log"
  on public.audit_log
  for select
  to authenticated
  using (true);

-- Sem policy de insert/update/delete: nega por completo mesmo para
-- authenticated, de propósito (ver nota no topo do arquivo).

-- Gate de manager dentro da própria função (não só no GRANT): sem isso,
-- qualquer authenticated — inclusive um viewer, que por desenho não tem
-- acesso de escrita a report_schedules/dashboard_shares — poderia chamar
-- esta RPC diretamente com action/resource_type/resource_id/metadata
-- arbitrários e inserir uma linha fabricada no que deveria ser o registro
-- confiável de "quem fez o quê". actor_id/actor_label continuam vindo do
-- JWT real (não são o problema — ninguém forja identidade); o problema era
-- o CONTEÚDO do evento ser 100% escolhido pelo chamador sem checar se ele
-- tinha qualquer relação com a ação que está afirmando ter feito. No-op
-- silencioso (não erro) para não vazar detalhe nenhum a quem não deveria
-- estar chamando isto de qualquer forma.
create or replace function public.record_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_user_role() <> 'manager' then
    return;
  end if;

  insert into public.audit_log (actor_id, actor_label, actor_type, action, resource_type, resource_id, metadata)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'unknown'), 'user', p_action, p_resource_type, p_resource_id, p_metadata);
end;
$$;

revoke all on function public.record_audit_event(text, text, uuid, jsonb) from public;
grant execute on function public.record_audit_event(text, text, uuid, jsonb) to authenticated;
-- "revoke ... from public" sozinho NÃO basta neste projeto — ver o mesmo
-- comentário em current_user_role() (20260814090000_user_roles_rbac.sql):
-- o Supabase concede EXECUTE a anon diretamente na criação da função, não
-- via PUBLIC. Sem este revoke explícito, qualquer visitante sem login
-- conseguiria chamar record_audit_event e inserir linhas arbitrárias em
-- audit_log (action/resource_type/resource_id/metadata todos escolhidos por
-- ele), corrompendo a trilha de auditoria.
revoke execute on function public.record_audit_event(text, text, uuid, jsonb) from anon;

comment on function public.record_audit_event is
  'Registra uma linha em audit_log com o ator resolvido do proprio JWT (auth.uid()/email) — usada pelo caminho direto-Supabase do navegador. O caminho service-role (rotas /api) insere direto na tabela, sem passar por esta funcao, com actor_type admin_token/cron.';
