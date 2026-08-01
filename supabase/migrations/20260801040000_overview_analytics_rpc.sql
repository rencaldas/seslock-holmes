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

-- Agrega tudo que o Overview precisa numa única chamada: totais, taxas, série
-- temporal, provedores, motivos de bounce e origens. Uma varredura só.
--
-- SECURITY INVOKER (o padrão) é essencial: a função respeita a RLS de quem
-- chama, então continua exigindo o papel `authenticated`. Marcá-la como
-- SECURITY DEFINER reabriria os dados para anon por outro caminho, desfazendo
-- a migration 20260801015212.
--
-- Quatro detalhes de paridade que só apareceram lendo o assembly do
-- buildOverviewAnalytics, e que estavam errados nas primeiras versões desta
-- função. Nenhum apareceria num teste de fumaça: todos produzem números
-- plausíveis e errados.
--
--   1. averageDeliveryTimeMs NÃO é avg("deliveryProcessingTimeMillis"), que é
--      o tempo de processamento do próprio SES. O JS calcula, por messageId,
--      o intervalo entre o primeiro evento 'sent' e o primeiro 'delivered'.
--      São métricas diferentes com nomes parecidos.
--
--      Achado colateral: nesta base o resultado é sempre 0, e não por bug.
--      São 43.608 pares completos, todos com delta exatamente zero — a
--      ingestão grava o mesmo timestamp para todos os eventos de uma mesma
--      mensagem. O card "tempo médio até entrega" nunca teve informação, e o
--      JS mostra o mesmo zero. A métrica só passa a existir se a ingestão
--      registrar o horário de cada evento.
--
--   2. Os cortes são slice(0, 8) no JS, não 10.
--
--   3. O JS desempata alfabeticamente quando as contagens empatam. Sem isso a
--      ordem do SQL é indeterminada e os cards trocariam de posição entre
--      execuções idênticas, sem nada ter mudado nos dados.
--
--   4. O motivo do bounce é UMA string (getBounceReason), montada como
--      bounceSubType || bounceType || diagnosticCode || failureReason ||
--      'N/A' — com o subtipo ANTES do tipo. Uma versão anterior devolvia os
--      três campos separados, formato que a UI nem consegue consumir.
--
-- Os filtros caros ficam atrás de um curto-circuito de string vazia. Sem
-- isso, o texto de busca das 25 colunas era montado para as 99 mil linhas
-- mesmo sem filtro de origem preenchido, e a função levava 9,3s em vez de 3,0s.
--
-- Os baldes da série temporal seguem a mesma regra do JS (até 3 dias agrupa
-- por hora, acima por dia) e são alinhados em UTC, porque o JS usa
-- Math.floor(ts / bucketMs), que é epoch puro — usar o fuso da sessão
-- deslocaria as barras do gráfico. Preencher as lacunas e traduzir os rótulos
-- continua no JS, que já faz isso e tem o Intl à mão.
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
    -- Mesma chave do JS: rowToEmailEvent faz messageId ?? id.
    coalesce(e."messageId", e.id::text) as chave,
    e."messageId",
    lower(btrim(e.destination)) as destinatario,
    e."timestamp",
    public.seslock_event_type(e."eventType", e."notificationType") as tipo,
    public.seslock_origin_label(e."snsTopicArn", e."sourceArn", e."fromAddress", e.source, e.subject) as origem,
    lower(btrim(split_part(e.destination, '@', 2))) as dominio,
    -- Réplica de getBounceReason. failureReason (rowToEmailEvent) já é
    -- bounceType || bounceSubType || diagnosticCode || complaintFeedbackType,
    -- então os três primeiros já foram testados e só sobra o último.
    coalesce(
      nullif(btrim(e."bounceSubType"), ''),
      nullif(btrim(e."bounceType"), ''),
      nullif(btrim(e."diagnosticCode"), ''),
      nullif(btrim(e."complaintFeedbackType"), ''),
      'N/A'
    ) as motivo
  from public.aws_sns e, params p
  -- Filtra pela coluna indexada. O JS usa timestamp ?? created_at, mas não há
  -- nenhum timestamp nulo na base (verificado); usar coalesce aqui impediria
  -- o Index Only Scan e devolveria a lentidão que esta migration remove.
  where e."timestamp" >= p_start
    and (p_end is null or e."timestamp" <= p_end)
    and (p_status = 'all'
         or public.seslock_event_type(e."eventType", e."notificationType") = p_status)
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
    min("timestamp") as primeiro_evento
  from filtrado
),
granularidade as (
  select case
    when extract(epoch from (coalesce(t.ultimo_evento, now()) - coalesce(t.primeiro_evento, now())))
         <= 3 * 24 * 3600 then 'hour' else 'day' end as g
  from totais t
),
baldes as (
  select date_trunc((select g from granularidade), f."timestamp" at time zone 'UTC') as balde,
    count(*) as total,
    count(*) filter (where tipo = 'sent') as enviados,
    count(*) filter (where tipo = 'delivered') as entregues,
    count(*) filter (where tipo = 'bounced') as bounces,
    count(*) filter (where tipo = 'complained') as reclamacoes
  from filtrado f group by 1 order by 1
),
provedores as (
  select dominio, count(*) as total,
         count(*) filter (where tipo = 'delivered') as entregues,
         count(*) filter (where tipo = 'bounced') as bounces
  from filtrado where dominio <> ''
  group by dominio
  order by total desc, dominio asc limit 8
),
motivos as (
  select motivo, count(*) as total
  from filtrado where tipo = 'bounced'
  group by motivo
  order by total desc, motivo asc limit 8
),
origens as (
  select origem, count(*) as total
  from filtrado group by origem
  order by total desc, origem asc limit 8
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
  'averageDeliveryTimeMs', (select round(ms) from media_entrega),
  -- Taxas em pontos percentuais (0-100), como no analytics.ts.
  'deliveryRate', case when t.total_eventos = 0 then null
                       else round(100.0 * t.entregues / t.total_eventos, 2) end,
  'bounceRate', case when t.total_eventos = 0 then 0
                     else round(100.0 * t.bounces / t.total_eventos, 2) end,
  'complaintRate', case when t.total_eventos = 0 then 0
                        else round(100.0 * t.reclamacoes / t.total_eventos, 2) end,
  'timeSeriesGranularity', (select g from granularidade),
  'timeSeries', coalesce((select jsonb_agg(jsonb_build_object(
                     'timestamp', (extract(epoch from balde) * 1000)::bigint,
                     'total', total, 'sent', enviados, 'delivered', entregues,
                     'bounced', bounces, 'complained', reclamacoes)
                   order by balde) from baldes), '[]'::jsonb),
  'topProviders', coalesce((select jsonb_agg(jsonb_build_object(
                     'domain', dominio, 'totalCount', total,
                     'deliveredCount', entregues, 'bouncedCount', bounces,
                     'bounceRate', case when total = 0 then 0
                                        else round(100.0 * bounces / total, 2) end)
                   order by total desc, dominio asc) from provedores), '[]'::jsonb),
  -- percentage sobre o total de bounces, como no JS (que divide por
  -- bouncedCount || 1 para não estourar quando não há nenhum).
  'topBounceReasons', coalesce((select jsonb_agg(jsonb_build_object(
                     'label', motivo, 'count', total,
                     'percentage', round(100.0 * total / greatest(t.bounces, 1), 2))
                   order by total desc, motivo asc) from motivos), '[]'::jsonb),
  'originApplications', coalesce((select jsonb_agg(jsonb_build_object(
                     'name', origem, 'count', total)
                   order by total desc, origem asc) from origens), '[]'::jsonb)
)
from totais t
$fn$;

comment on function public.overview_analytics is
  'Agrega os eventos do SES para o Overview sem mandar linhas brutas ao navegador. Respeita a RLS de quem chama (SECURITY INVOKER).';

