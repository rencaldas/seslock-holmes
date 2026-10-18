-- Métricas do dashboard compartilhado deixam de ser afetadas pelos filtros.
--
-- Antes, get_shared_dashboard repassava status/bounceSubType/origem/assunto/
-- provedor do link para overview_analytics, então um link filtrado por
-- "Bounce" mostrava "100% de bounce" nos indicadores. Agora os indicadores
-- (taxas, reputação, distribuição, série temporal) cobrem todos os eventos da
-- janela de tempo do link; os filtros salvos continuam restringindo apenas a
-- lista de atividade recente. Mesma regra aplicada no Overview autenticado.
--
-- Só o corpo muda — a assinatura (p_token text) é a mesma, então o
-- create or replace substitui a função sem criar sobrecarga.

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
  -- As métricas do painel ignoram os filtros de conteúdo do link (status,
  -- subtipo de bounce, origem, assunto, provedor) e só respeitam a janela de
  -- tempo — mesma regra do Overview autenticado (ver fetchOverviewAggregate).
  -- Os filtros continuam valendo para a lista de atividade abaixo.
  v_analytics := public.overview_analytics(
    v_start,
    null,
    'all',
    '',
    '',
    '',
    null,
    'all'
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
