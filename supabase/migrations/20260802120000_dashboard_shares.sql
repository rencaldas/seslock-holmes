-- Links de dashboard compartilhados: um visitante sem login (e sem qualquer
-- conta no projeto Supabase) pode abrir uma URL /share/:token e ver uma
-- versão somente-leitura, com filtros travados, do Overview.
--
-- Migration portátil (mesmo espírito de 20260730120000_report_schedules.sql):
-- funciona tanto no projeto padrão desta implantação quanto em qualquer
-- projeto Supabase próprio que alguém aponte o painel para (Configurações).
--
-- POR QUE SECURITY DEFINER É SEGURO AQUI, AO CONTRÁRIO DE overview_analytics:
--
-- O comentário em overview_analytics (20260801130000) é explícito: marcá-la
-- como SECURITY DEFINER reabriria aws_sns para o anon por completo, porque
-- ela aceita filtros arbitrários vindos de quem chama. get_shared_dashboard
-- é uma superfície fundamentalmente mais estreita: o ÚNICO parâmetro vindo do
-- chamador é um token opaco de 256 bits. Os filtros de fato usados na consulta
-- nunca vêm do chamador — vêm da linha trancada em dashboard_shares, escrita
-- no momento em que o link foi criado por alguém autenticado. Não há como usar
-- esta função para consultar nada além do que o criador do link já escolheu
-- expor, e cada link é revogável/expirável independentemente.
--
-- dashboard_shares em si NUNCA é lida diretamente pelo anon (zero policy para
-- esse papel — só "authenticated" abaixo). O único jeito de ler uma linha é
-- através desta função, que devolve o resultado agregado, nunca o token_hash
-- nem as demais linhas da tabela.

-- Em projetos Supabase, pgcrypto normalmente já vem instalado no schema
-- `extensions` (não em `public`) — por isso get_shared_dashboard chama
-- extensions.digest(...) totalmente qualificado, em vez de alargar seu
-- search_path para incluir `extensions`. Este CREATE EXTENSION serve só para
-- quem monta o schema do zero num projeto que ainda não o tem.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.dashboard_shares (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 hex do token aleatório de 256 bits gerado no navegador e mostrado
  -- a quem cria o link uma única vez — nunca armazenado em forma recuperável,
  -- mesmo padrão de report_connections.token_hash.
  token_hash text not null unique,
  label text,
  events_table text not null default 'aws_sns',
  -- Subconjunto de OverviewSearchFilters: windowDays, status, bounceSubType,
  -- origin, subject, provider. windowDays é reinterpretado a cada acesso
  -- (janela viva, "últimos N dias a partir de agora"), não um recorte de
  -- datas absolutas — mesma escolha de ScheduleFilters em scheduled-reports,
  -- pelo mesmo motivo: um link "últimos 7 dias" deve continuar útil semanas
  -- depois de criado.
  filters jsonb not null default '{}'::jsonb,
  -- Desligado por padrão: a lista de atividade recente expõe e-mail real de
  -- destinatário (PII). Quem cria o link liga isso de propósito.
  include_recent_activity boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz
);

create index if not exists dashboard_shares_created_by_idx
  on public.dashboard_shares (created_by);

alter table public.dashboard_shares enable row level security;

-- Mesmo modelo de report_schedules: cadastro de conta é fechado (feito por um
-- administrador), então "qualquer autenticado gerencia" não abre a porta para
-- desconhecidos — só para quem já tem login no time.
create policy "Authenticated can manage dashboard shares"
  on public.dashboard_shares
  for all
  to authenticated
  using (true)
  with check (true);

-- Deliberadamente sem nenhuma policy para anon: a tabela nega esse papel por
-- completo, inclusive para verificar se um token existe. O único caminho de
-- leitura pública é a função abaixo.

create or replace function public.get_shared_dashboard(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_share          public.dashboard_shares%rowtype;
  v_hash           text;
  v_start          timestamptz;
  v_status         text;
  v_bounce_subtype text;
  v_analytics      jsonb;
  v_events         jsonb := null;
begin
  if p_token is null or btrim(p_token) = '' then
    return jsonb_build_object('error', 'not_found');
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_share from public.dashboard_shares where token_hash = v_hash;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_share.revoked_at is not null then
    return jsonb_build_object('error', 'revoked');
  end if;

  if v_share.expires_at is not null and v_share.expires_at <= now() then
    return jsonb_build_object('error', 'expired');
  end if;

  update public.dashboard_shares set last_accessed_at = now() where id = v_share.id;

  v_start := now() - make_interval(days => greatest(coalesce((v_share.filters->>'windowDays')::int, 7), 1));

  v_status := coalesce(v_share.filters->>'status', 'all');
  -- overview_analytics/overview_events aplicam bounceSubType de forma
  -- incondicional, sem checar status — então um subtipo salvo antes (a UI só
  -- esconde o seletor quando status muda de volta para "all", não zera o
  -- valor) faria um link "todos os e-mails" mostrar só bounces daquele
  -- subtipo. Normalizado aqui pra 'all' sempre que status não for 'bounced',
  -- o que também conserta retroativamente shares já criados com esse defeito.
  v_bounce_subtype := case when v_status = 'bounced'
    then coalesce(v_share.filters->>'bounceSubType', 'all')
    else 'all'
  end;

  -- Chama overview_analytics/overview_events (SECURITY INVOKER) de dentro de
  -- uma função SECURITY DEFINER: elas passam a rodar com o privilégio de quem
  -- É DONO desta função, não do anon que chamou get_shared_dashboard — é
  -- assim que a leitura de aws_sns consegue ignorar a RLS sem que a própria
  -- overview_analytics precise virar DEFINER (o que a exporia por completo).
  v_analytics := public.overview_analytics(
    v_start,
    null,
    v_status,
    coalesce(v_share.filters->>'origin', ''),
    coalesce(v_share.filters->>'subject', ''),
    coalesce(v_share.filters->>'provider', ''),
    null,
    v_bounce_subtype
  );

  if v_share.include_recent_activity then
    v_events := public.overview_events(
      v_start,
      null,
      v_status,
      coalesce(v_share.filters->>'origin', ''),
      coalesce(v_share.filters->>'subject', ''),
      coalesce(v_share.filters->>'provider', ''),
      'time-desc',
      50,
      0,
      null,
      v_bounce_subtype
    );
  end if;

  return jsonb_build_object(
    'label', v_share.label,
    'filters', v_share.filters,
    'includeRecentActivity', v_share.include_recent_activity,
    'analytics', v_analytics,
    'events', v_events
  );
end;
$fn$;

revoke all on function public.get_shared_dashboard(text) from public;
grant execute on function public.get_shared_dashboard(text) to anon, authenticated;

comment on function public.get_shared_dashboard is
  'Leitura publica gated por token para links de dashboard compartilhados. SECURITY DEFINER de proposito: a unica entrada do chamador e um token opaco, nunca um filtro — ver o comentario no topo do arquivo desta migration.';
