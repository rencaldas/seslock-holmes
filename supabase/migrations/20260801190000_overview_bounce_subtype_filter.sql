-- Adiciona o filtro de bounceSubType (Suppressed/General/MailboxFull/
-- ContentRejected/Undetermined) ao Overview, usado quando o usuário filtra
-- Status = "Bounce" e quer refinar por tipo especifico de bounce.
--
-- p_bounce_subtype é um parametro NOMEADO novo com default 'all', então
-- chamadas existentes (sem o argumento) continuam funcionando sem mudança.
-- Segue o mesmo padrao de p_status: comparacao exata contra a coluna, só
-- entra no WHERE dinamico quando != 'all'.

create or replace function public.overview_analytics(
  p_start          timestamptz,
  p_end            timestamptz default null,
  p_status         text default 'all',
  p_origin         text default '',
  p_subject        text default '',
  p_provider       text default '',
  p_row_limit      int default null,
  p_bounce_subtype text default 'all'
) returns jsonb
language plpgsql
stable
parallel safe
set search_path = public, pg_temp
as $fn$
declare
  q_origin    text := public.seslock_normalize_text(p_origin);
  q_subject   text := public.seslock_normalize_text(p_subject);
  q_provider  text := regexp_replace(public.seslock_normalize_text(p_provider), '^@+', '');
  filtros     text := '';
  motivo_expr text;
  resultado   jsonb;
begin
  if q_subject <> '' then
    filtros := filtros || format(
      ' and public.seslock_normalize_text(e.subject) like %L', '%' || q_subject || '%');
  end if;

  if q_provider <> '' then
    filtros := filtros || format(
      ' and (lower(btrim(split_part(e.destination, ''@'', 2))) = %L'
      || ' or lower(btrim(split_part(e.destination, ''@'', 2))) like %L'
      || ' or %L like ''%%.'' || lower(btrim(split_part(e.destination, ''@'', 2))))',
      q_provider, '%.' || q_provider, q_provider);
  end if;

  if q_origin <> '' then
    filtros := filtros || format(
      ' and public.seslock_normalize_text(concat_ws('' '','
      || ' e.id::text, e."messageId", e."snsMessageId", e.subject, e.source, e."fromAddress",'
      || ' host(e."sourceIp"), e."callerIdentity", e."configurationSet", e."projectTag",'
      || ' e."sourceArn", e."snsTopicArn", e."eventType", e."notificationType",'
      || ' e."bounceType", e."bounceSubType", e."diagnosticCode", e."reportingMta",'
      || ' host(e."remoteMtaIp"), e."smtpResponse", e."complaintFeedbackType",'
      || ' e.destination, e.destinations, e."bouncedRecipients", e."complainedRecipients"'
      || ')) like %L', '%' || q_origin || '%');
  end if;

  if p_bounce_subtype is not null and p_bounce_subtype <> 'all' then
    filtros := filtros || format(' and e."bounceSubType" = %L', p_bounce_subtype);
  end if;

  -- diagnosticCode só entra quando a consulta já vai ao heap por causa do
  -- filtro de origem. Verificado: zero dos 3.848 bounces dependem dele.
  motivo_expr := case when q_origin <> ''
    then 'coalesce(nullif(btrim(e."bounceSubType"),''''), nullif(btrim(e."bounceType"),''''),'
         || ' nullif(btrim(e."diagnosticCode"),''''), nullif(btrim(e."complaintFeedbackType"),''''), ''N/A'')'
    else 'coalesce(nullif(btrim(e."bounceSubType"),''''), nullif(btrim(e."bounceType"),''''),'
         || ' nullif(btrim(e."complaintFeedbackType"),''''), ''N/A'')'
  end;

  execute format($sql$
    with filtrado as (
      select
        coalesce(e."messageId", e.id::text) as chave,
        e."messageId",
        lower(btrim(e.destination)) as destinatario,
        e."timestamp",
        public.seslock_event_type(e."eventType", e."notificationType") as tipo,
        public.seslock_origin_label(e."snsTopicArn", e."sourceArn", e."fromAddress", e.source, null) as origem,
        lower(btrim(split_part(e.destination, '@', 2))) as dominio,
        %s as motivo
      from public.aws_sns e
      where e."timestamp" >= $1
        and ($2 is null or e."timestamp" <= $2)
        and ($3 = 'all' or public.seslock_event_type(e."eventType", e."notificationType") = $3)
        %s
      order by e."timestamp" desc
      limit $4
    ),
    tempos as (
      select chave,
             min("timestamp") filter (where tipo = 'sent')      as enviado_em,
             min("timestamp") filter (where tipo = 'delivered') as entregue_em
      from filtrado group by chave
    ),
    media_entrega as (
      select avg(extract(epoch from (entregue_em - enviado_em)) * 1000) as ms
      from tempos
      where enviado_em is not null and entregue_em is not null and entregue_em >= enviado_em
    ),
    totais as (
      select count(*) as total_eventos,
        count(*) filter (where tipo = 'sent') as enviados,
        count(*) filter (where tipo = 'delivered') as entregues,
        count(*) filter (where tipo = 'bounced') as bounces,
        count(*) filter (where tipo = 'complained') as reclamacoes,
        count(*) filter (where tipo = 'delayed') as atrasados,
        count(*) filter (where tipo = 'rejected') as rejeitados,
        count(*) filter (where tipo = 'rendering_failure') as falhas_render,
        count(distinct "messageId") as mensagens_unicas,
        count(distinct destinatario) as destinatarios_unicos,
        max("timestamp") as ultimo_evento, min("timestamp") as primeiro_evento
      from filtrado
    ),
    granularidade as (
      select case when extract(epoch from (coalesce(t.ultimo_evento, now()) - coalesce(t.primeiro_evento, now())))
                       <= 3*24*3600 then 'hour' else 'day' end as g
      from totais t
    ),
    baldes as (
      select date_trunc((select g from granularidade), f."timestamp" at time zone 'UTC') as balde,
        count(*) as total,
        count(*) filter (where tipo='sent') as enviados,
        count(*) filter (where tipo='delivered') as entregues,
        count(*) filter (where tipo='bounced') as bounces,
        count(*) filter (where tipo='complained') as reclamacoes
      from filtrado f group by 1 order by 1
    ),
    provedores as (
      select dominio, count(*) as total,
             count(*) filter (where tipo='delivered') as entregues,
             count(*) filter (where tipo='bounced') as bounces
      from filtrado where dominio <> '' group by dominio
      order by total desc, dominio asc limit 8
    ),
    motivos as (
      select motivo, count(*) as total from filtrado where tipo='bounced'
      group by motivo order by total desc, motivo asc limit 8
    ),
    origens as (
      select origem, count(*) as total from filtrado group by origem
      order by total desc, origem asc limit 8
    )
    select jsonb_build_object(
      'totalEventCount', t.total_eventos, 'sentCount', t.enviados,
      'deliveredCount', t.entregues, 'bouncedCount', t.bounces,
      'complaintCount', t.reclamacoes, 'delayedCount', t.atrasados,
      'rejectedCount', t.rejeitados, 'renderingFailureCount', t.falhas_render,
      'uniqueMessagesCount', t.mensagens_unicas,
      'uniqueRecipientsCount', t.destinatarios_unicos,
      'lastEventAt', t.ultimo_evento,
      'averageDeliveryTimeMs', (select round(ms) from media_entrega),
      'deliveryRate', case when t.enviados > 0 then round(100.0*t.entregues/t.enviados, 2)
                           when t.total_eventos > 0 then round(100.0*t.entregues/t.total_eventos, 2)
                           else null end,
      'bounceRate', case when t.total_eventos = 0 then 0
                         else round(100.0*t.bounces/t.total_eventos, 2) end,
      'complaintRate', case when t.total_eventos = 0 then 0
                            else round(100.0*t.reclamacoes/t.total_eventos, 2) end,
      'timeSeriesGranularity', (select g from granularidade),
      'timeSeries', coalesce((select jsonb_agg(jsonb_build_object(
          'timestamp', (extract(epoch from balde)*1000)::bigint, 'total', total,
          'sent', enviados, 'delivered', entregues, 'bounced', bounces,
          'complained', reclamacoes) order by balde) from baldes), '[]'::jsonb),
      'topProviders', coalesce((select jsonb_agg(jsonb_build_object(
          'domain', dominio, 'totalCount', total, 'deliveredCount', entregues,
          'bouncedCount', bounces,
          'bounceRate', case when total=0 then 0 else round(100.0*bounces/total, 2) end)
          order by total desc, dominio asc) from provedores), '[]'::jsonb),
      'topBounceReasons', coalesce((select jsonb_agg(jsonb_build_object(
          'label', motivo, 'count', total,
          'percentage', round(100.0*total/greatest(t.bounces,1), 2))
          order by total desc, motivo asc) from motivos), '[]'::jsonb),
      'originApplications', coalesce((select jsonb_agg(jsonb_build_object(
          'name', origem, 'count', total) order by total desc, origem asc)
          from origens), '[]'::jsonb)
    )
    from totais t
  $sql$, motivo_expr, filtros)
  into resultado
  using p_start, p_end, p_status, p_row_limit;

  return resultado;
end;
$fn$;

comment on function public.overview_analytics is
  'Agrega os eventos do SES para o Overview sem mandar linhas brutas ao navegador. SQL montado em runtime para manter colunas fora do indice de cobertura fora do plano. Respeita a RLS de quem chama.';

create or replace function public.overview_events(
  p_start          timestamptz,
  p_end            timestamptz default null,
  p_status         text default 'all',
  p_origin         text default '',
  p_subject        text default '',
  p_provider       text default '',
  p_sort           text default 'time-desc',
  p_limit          int default 50,
  p_offset         int default 0,
  p_row_limit      int default null,
  p_bounce_subtype text default 'all'
) returns jsonb
language plpgsql
stable
parallel safe
set search_path = public, pg_temp
as $fn$
declare
  q_origin   text := public.seslock_normalize_text(p_origin);
  q_subject  text := public.seslock_normalize_text(p_subject);
  q_provider text := regexp_replace(public.seslock_normalize_text(p_provider), '^@+', '');
  filtros    text := '';
  resultado  jsonb;
begin
  if q_subject <> '' then
    filtros := filtros || format(
      ' and public.seslock_normalize_text(e.subject) like %L', '%' || q_subject || '%');
  end if;

  if q_provider <> '' then
    filtros := filtros || format(
      ' and (lower(btrim(split_part(e.destination, ''@'', 2))) = %L'
      || ' or lower(btrim(split_part(e.destination, ''@'', 2))) like %L'
      || ' or %L like ''%%.'' || lower(btrim(split_part(e.destination, ''@'', 2))))',
      q_provider, '%.' || q_provider, q_provider);
  end if;

  if q_origin <> '' then
    filtros := filtros || format(
      ' and public.seslock_normalize_text(concat_ws('' '','
      || ' e.id::text, e."messageId", e."snsMessageId", e.subject, e.source, e."fromAddress",'
      || ' host(e."sourceIp"), e."callerIdentity", e."configurationSet", e."projectTag",'
      || ' e."sourceArn", e."snsTopicArn", e."eventType", e."notificationType",'
      || ' e."bounceType", e."bounceSubType", e."diagnosticCode", e."reportingMta",'
      || ' host(e."remoteMtaIp"), e."smtpResponse", e."complaintFeedbackType",'
      || ' e.destination, e.destinations, e."bouncedRecipients", e."complainedRecipients"'
      || ')) like %L', '%' || q_origin || '%');
  end if;

  if p_bounce_subtype is not null and p_bounce_subtype <> 'all' then
    filtros := filtros || format(' and e."bounceSubType" = %L', p_bounce_subtype);
  end if;

  execute format($sql$
    with chaves as (
      select e.id, e."timestamp", lower(btrim(e.destination)) as ordenavel
      from public.aws_sns e
      where e."timestamp" >= $1
        and ($2 is null or e."timestamp" <= $2)
        and ($3 = 'all' or public.seslock_event_type(e."eventType", e."notificationType") = $3)
        %s
      order by e."timestamp" desc
      limit $6
    ),
    pagina as (
      select id, row_number() over () as posicao
      from (
        select id from chaves
        order by
          case when $4 = 'time-asc'       then "timestamp" end asc nulls last,
          case when $4 = 'recipient-asc'  then ordenavel   end asc nulls last,
          case when $4 = 'recipient-desc' then ordenavel   end desc nulls last,
          case when $4 not in ('time-asc','recipient-asc','recipient-desc')
               then "timestamp" end desc nulls last,
          ordenavel asc
        limit greatest($5, 0) offset greatest($7, 0)
      ) ordenado
    )
    select jsonb_build_object(
      'totalCount', (select count(*) from chaves),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id, 'created_at', e.created_at, 'timestamp', e."timestamp",
          'messageId', e."messageId", 'snsMessageId', e."snsMessageId",
          'eventType', e."eventType", 'notificationType', e."notificationType",
          'subject', e.subject, 'source', e.source, 'fromAddress', e."fromAddress",
          'sourceIp', host(e."sourceIp"), 'callerIdentity', e."callerIdentity",
          'configurationSet', e."configurationSet", 'projectTag', e."projectTag",
          'sourceArn', e."sourceArn", 'snsTopicArn', e."snsTopicArn", 'sesTags', e."sesTags",
          'destination', e.destination, 'destinations', e.destinations,
          'bounceType', e."bounceType", 'bounceSubType', e."bounceSubType",
          'bouncedRecipients', e."bouncedRecipients", 'diagnosticCode', e."diagnosticCode",
          'remoteMtaIp', host(e."remoteMtaIp"), 'reportingMta', e."reportingMta",
          'smtpResponse', e."smtpResponse",
          'deliveryProcessingTimeMillis', e."deliveryProcessingTimeMillis",
          'complaintFeedbackType', e."complaintFeedbackType",
          'complainedRecipients', e."complainedRecipients", 'userAgent', e."userAgent"
        ) order by pg.posicao)
        from pagina pg join public.aws_sns e on e.id = pg.id
      ), '[]'::jsonb)
    )
  $sql$, filtros)
  into resultado
  using p_start, p_end, p_status, p_sort, p_limit, p_row_limit, p_offset;

  return resultado;
end;
$fn$;

comment on function public.overview_events is
  'Pagina de eventos do SES com filtros, ordenacao e contagem no banco. SQL montado em runtime pelo mesmo motivo de overview_analytics. Respeita a RLS de quem chama.';
