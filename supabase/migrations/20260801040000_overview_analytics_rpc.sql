-- Agregação do Overview movida para o banco.
--
-- POR QUE: o painel buscava até 20.000 linhas para o navegador e calculava
-- tudo em JS. Além de lento (20 idas e voltas HTTP sequenciais, de 1000 em
-- 1000), isso dava NÚMEROS ERRADOS: com 99.035 eventos em 30 dias, o teto de
-- 20.000 cobria só os 8 dias mais recentes. A taxa de bounce exibida era
-- 2,53% quando a real de 30 dias é 3,01% — rótulo de 30 dias, dado de 8 dias.
-- Aumentar o teto não resolveria; o navegador é que não deveria receber
-- linha bruta para calcular uma média.
--
-- Aqui ele passa a receber ~50 linhas agregadas, exatas sobre 100% do período.
--
-- PARIDADE: as funções replicam deliberadamente o comportamento de
-- src/lib/supabase/aws-sns.ts e src/lib/overview/analytics.ts, incluindo as
-- esquisitices. Divergir "para melhorar" aqui mudaria os números sem aviso.

create extension if not exists unaccent;

-- Índice de cobertura. NÃO é um detalhe de tuning: sem ele esta migration é
-- mais LENTA que o código que substitui. Medido em produção, agregação de 30
-- dias: 11,8s sem índice (75.559 buffers, o índice achava as linhas e ia ao
-- heap de 460 MB para cada uma, porque raw_payload deixa a tabela em ~3,7 KB
-- por linha) contra 0,8s com ele (7.165 buffers, Index Only Scan).
--
-- Em produção foi criado com CONCURRENTLY, fora de transação. A forma abaixo
-- serve para montar o schema do zero. Custa 17 MB.
--
-- `subject` foi deliberadamente deixado de fora do INCLUDE: ele é o único
-- campo de tamanho não limitado aqui (hoje o maior tem 133 caracteres, mas o
-- SES permite bem mais), e uma entrada de índice acima do limite do btree
-- faria o INSERT falhar — ou seja, quebraria a ingestão do SNS para ganhar
-- alguns milissegundos de leitura. Não compensa.
create index if not exists aws_sns_overview_cover2_idx
  on public.aws_sns ("timestamp" desc)
  include ("eventType", "notificationType", "messageId", destination, "deliveryProcessingTimeMillis");

-- Equivalente ao normalizeText do JS: trim, minúsculas, sem acentos.
-- STABLE e não IMMUTABLE porque unaccent depende do dicionário instalado.
create or replace function public.seslock_normalize_text(value text)
returns text language sql stable parallel safe as $$
  select coalesce(lower(unaccent(btrim(value))), '')
$$;

-- Equivalente ao normalizeAwsSnsEventType.
--
-- Duas heranças que parecem bug e são intencionais:
--   1. 'send' NÃO está na lista. "SEND" — 47% da base — cai no ELSE e vira
--      'sent'. O mapa do JS também não tem essa chave; chega ao mesmo lugar
--      pelo default. Mantido para bater exatamente.
--   2. Qualquer valor desconhecido também vira 'sent'. Se a AWS introduzir um
--      tipo novo, ele será contado como enviado em vez de virar categoria
--      própria. É o comportamento atual do painel, não uma decisão nova.
--
-- IMMUTABLE de propósito (não usa unaccent): permite indexar por esta
-- expressão no futuro.
create or replace function public.seslock_event_type(event_type text, notification_type text)
returns text language sql immutable parallel safe as $$
  -- coalesce reproduz o `??` do JS: só NULL cai para o próximo. Há 2 linhas
  -- na base com eventType nulo e notificationType 'Delivery' que dependem
  -- disto para contar como entregues.
  select case regexp_replace(lower(btrim(coalesce(event_type, notification_type, ''))), '\s+', '_', 'g')
    when 'delivery'          then 'delivered'
    when 'delivered'         then 'delivered'
    when 'bounce'            then 'bounced'
    when 'bounced'           then 'bounced'
    when 'complaint'         then 'complained'
    when 'complained'        then 'complained'
    when 'deliverydelay'     then 'delayed'
    when 'delivery_delay'    then 'delayed'
    when 'delay'             then 'delayed'
    when 'delayed'           then 'delayed'
    when 'reject'            then 'rejected'
    when 'rejected'          then 'rejected'
    when 'renderingfailure'  then 'rendering_failure'
    when 'rendering_failure' then 'rendering_failure'
    else 'sent'
  end
$$;

-- Equivalente ao summarizeArn: último segmento depois de ':' e depois de '/'.
create or replace function public.seslock_summarize_arn(value text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(regexp_replace(coalesce(btrim(value), ''), '^.*:', ''), '^.*/', '')
$$;

-- Equivalente ao originLabel de rowToEmailEvent.
--
-- Nota: no JS, getOriginApplicationLabel testa seis campos em cascata, mas
-- este valor nunca é vazio (termina em 'Origem desconhecida'), então os
-- outros cinco são inalcançáveis. Replicado só o ramo que de fato executa.
create or replace function public.seslock_origin_label(
  sns_topic_arn text, source_arn text, from_address text, source text, subject text
) returns text language sql immutable parallel safe as $$
  select coalesce(
    nullif(public.seslock_summarize_arn(sns_topic_arn), ''),
    nullif(public.seslock_summarize_arn(source_arn), ''),
    nullif(btrim(coalesce(from_address, '')), ''),
    nullif(btrim(coalesce(source, '')), ''),
    nullif(btrim(coalesce(subject, '')), ''),
    'Origem desconhecida'
  )
$$;

-- Agrega tudo que o Overview precisa numa única chamada.
--
-- SECURITY INVOKER (o padrão) é essencial: a função respeita a RLS de quem
-- chama, então continua exigindo o papel `authenticated`. Marcá-la como
-- SECURITY DEFINER reabriria os dados para anon por outro caminho, desfazendo
-- a migration 20260801015212.
create or replace function public.overview_analytics(
  p_start     timestamptz,
  p_end       timestamptz default null,
  p_status    text default 'all',
  p_origin    text default '',
  p_subject   text default '',
  p_provider  text default ''
) returns jsonb
language sql
stable
parallel safe
set search_path = public, pg_temp
as $fn$
with params as (
  select public.seslock_normalize_text(p_origin)   as q_origin,
         public.seslock_normalize_text(p_subject)  as q_subject,
         regexp_replace(public.seslock_normalize_text(p_provider), '^@+', '') as q_provider
),
filtrado as (
  select
    e."messageId",
    lower(btrim(e.destination)) as destinatario,
    e."deliveryProcessingTimeMillis",
    e."timestamp",
    e."bounceType", e."bounceSubType", e."diagnosticCode",
    public.seslock_event_type(e."eventType", e."notificationType") as tipo,
    public.seslock_origin_label(e."snsTopicArn", e."sourceArn", e."fromAddress", e.source, e.subject) as origem,
    lower(btrim(split_part(e.destination, '@', 2))) as dominio
  from public.aws_sns e, params p
  -- Filtra pela coluna indexada. O JS usa timestamp ?? created_at, mas não há
  -- nenhum timestamp nulo na base (verificado); usar coalesce aqui impediria
  -- o Index Only Scan e devolveria a lentidão que esta migration remove.
  where e."timestamp" >= p_start
    and (p_end is null or e."timestamp" <= p_end)
    and (p_status = 'all'
         or public.seslock_event_type(e."eventType", e."notificationType") = p_status)
    -- Cada filtro caro só é avaliado quando de fato preenchido: o OR
    -- curto-circuita no teste barato de string vazia. Sem isso, o texto de
    -- busca era montado para as 99 mil linhas mesmo sem filtro nenhum, o que
    -- levou a primeira versão desta função a 9,3s contra os 3,0s atuais.
    and (p.q_subject = ''
         or public.seslock_normalize_text(e.subject) like '%' || p.q_subject || '%')
    and (p.q_provider = ''
         or lower(btrim(split_part(e.destination, '@', 2))) = p.q_provider
         or lower(btrim(split_part(e.destination, '@', 2))) like '%.' || p.q_provider
         or p.q_provider like '%.' || lower(btrim(split_part(e.destination, '@', 2))))
    -- Equivalente ao getAwsSnsRowSearchText: mesma lista de campos, mesma ordem.
    and (p.q_origin = ''
         or public.seslock_normalize_text(concat_ws(' ',
              e.id::text, e."messageId", e."snsMessageId", e.subject, e.source, e."fromAddress",
              host(e."sourceIp"), e."callerIdentity", e."configurationSet", e."projectTag",
              e."sourceArn", e."snsTopicArn", e."eventType", e."notificationType",
              e."bounceType", e."bounceSubType", e."diagnosticCode", e."reportingMta",
              host(e."remoteMtaIp"), e."smtpResponse", e."complaintFeedbackType",
              e.destination, e.destinations, e."bouncedRecipients", e."complainedRecipients"
            )) like '%' || p.q_origin || '%')
),
totais as (
  select
    count(*) as total_eventos,
    count(*) filter (where tipo = 'sent') as enviados,
    count(*) filter (where tipo = 'delivered') as entregues,
    count(*) filter (where tipo = 'bounced') as bounces,
    count(*) filter (where tipo = 'complained') as reclamacoes,
    count(*) filter (where tipo = 'delayed') as atrasados,
    count(*) filter (where tipo = 'rejected') as rejeitados,
    count(*) filter (where tipo = 'rendering_failure') as falhas_render,
    count(distinct "messageId") as mensagens_unicas,
    count(distinct destinatario) as destinatarios_unicos,
    max("timestamp") as ultimo_evento,
    avg("deliveryProcessingTimeMillis") filter (
      where tipo = 'delivered' and "deliveryProcessingTimeMillis" is not null
    ) as tempo_medio_ms
  from filtrado
),
provedores as (
  select dominio, count(*) as total,
         count(*) filter (where tipo = 'delivered') as entregues,
         count(*) filter (where tipo = 'bounced') as bounces
  from filtrado where dominio <> '' group by dominio order by total desc limit 10
),
motivos as (
  select coalesce(nullif(btrim("bounceType"), ''), 'Desconhecido') as tipo_bounce,
         coalesce(nullif(btrim("bounceSubType"), ''), '') as subtipo,
         coalesce(nullif(btrim("diagnosticCode"), ''), '') as diagnostico,
         count(*) as total
  from filtrado where tipo = 'bounced' group by 1,2,3 order by total desc limit 10
),
origens as (
  select origem, count(*) as total
  from filtrado group by origem order by total desc limit 10
)
select jsonb_build_object(
  'totalEventCount', t.total_eventos,
  'sentCount', t.enviados,
  'deliveredCount', t.entregues,
  'bouncedCount', t.bounces,
  'complaintCount', t.reclamacoes,
  'delayedCount', t.atrasados,
  'rejectedCount', t.rejeitados,
  'renderingFailureCount', t.falhas_render,
  'uniqueMessagesCount', t.mensagens_unicas,
  'uniqueRecipientsCount', t.destinatarios_unicos,
  'lastEventAt', t.ultimo_evento,
  'averageDeliveryTimeMs', round(t.tempo_medio_ms),
  -- Taxas em pontos percentuais (0-100), como no analytics.ts.
  'deliveryRate', case when t.total_eventos = 0 then null
                       else round(100.0 * t.entregues / t.total_eventos, 2) end,
  'bounceRate', case when t.total_eventos = 0 then 0
                     else round(100.0 * t.bounces / t.total_eventos, 2) end,
  'complaintRate', case when t.total_eventos = 0 then 0
                        else round(100.0 * t.reclamacoes / t.total_eventos, 2) end,
  'topProviders', coalesce((select jsonb_agg(jsonb_build_object(
                     'domain', dominio, 'totalCount', total,
                     'deliveredCount', entregues, 'bouncedCount', bounces,
                     'bounceRate', case when total = 0 then 0
                                        else round(100.0 * bounces / total, 2) end)) from provedores), '[]'::jsonb),
  'topBounceReasons', coalesce((select jsonb_agg(jsonb_build_object(
                     'bounceType', tipo_bounce, 'bounceSubType', subtipo,
                     'diagnosticCode', diagnostico, 'count', total)) from motivos), '[]'::jsonb),
  'originApplications', coalesce((select jsonb_agg(jsonb_build_object(
                     'name', origem, 'count', total)) from origens), '[]'::jsonb)
)
from totais t
$fn$;

comment on function public.overview_analytics is
  'Agrega os eventos do SES para o Overview sem mandar linhas brutas ao navegador. Respeita a RLS de quem chama (SECURITY INVOKER).';
