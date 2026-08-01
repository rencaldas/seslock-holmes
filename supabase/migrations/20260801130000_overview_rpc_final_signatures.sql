-- Consolida as assinaturas finais das funções do Overview e remove as
-- sobrecargas acidentais.
--
-- O QUE DEU ERRADO: ao acrescentar p_row_limit às funções criadas em
-- 20260801040000, usei `create or replace function`. Mudar a lista de
-- parâmetros NÃO substitui a função — cria uma sobrecarga. Ficaram duas
-- versões de cada uma, diferindo apenas por um parâmetro que tem valor padrão.
--
-- Para o PostgREST isso é ambíguo: uma chamada com os 6 (ou 9) argumentos
-- nomeados casa com as duas candidatas, e ele recusa a requisição em vez de
-- escolher. O painel quebrou com "Algo deu errado" — sem erro de SQL, sem erro
-- de build, só a resolução da função falhando em tempo de execução.
--
-- Lição para a próxima: acrescentar parâmetro a uma função exposta por RPC
-- exige DROP explícito da assinatura antiga. `create or replace` só protege
-- quando a lista de parâmetros é idêntica.
--
-- Esta migration é idempotente e representa o estado final aplicado.

drop function if exists public.overview_analytics(
  timestamptz, timestamptz, text, text, text, text
);

drop function if exists public.overview_events(
  timestamptz, timestamptz, text, text, text, text, text, integer, integer
);

-- ---------------------------------------------------------------------------
-- overview_analytics
-- ---------------------------------------------------------------------------
-- Agrega totais, taxas, série temporal, provedores, motivos de bounce e
-- origens numa única varredura.
--
-- SECURITY INVOKER (o padrão) é essencial: a função respeita a RLS de quem
-- chama, então continua exigindo o papel `authenticated`. Verificado: anon
-- recebe 42501 "permission denied for table aws_sns" ao chamá-la — que é
-- justamente o erro que faz a tela de login aparecer. Marcá-la como SECURITY
-- DEFINER reabriria os dados para anon, desfazendo 20260801015212.
--
-- p_row_limit existe mas o painel passa null de propósito: os indicadores
-- devem refletir a janela inteira. O seletor de linhas da tela vale só para o
-- relatório CSV/PDF. Ver o comentário em lib/supabase/queries/overview-aggregate.ts.
create or replace function public.overview_analytics(
  p_start     timestamptz,
  p_end       timestamptz default null,
  p_status    text default 'all',
  p_origin    text default '',
  p_subject   text default '',
  p_provider  text default '',
  p_row_limit int default null
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
-- Recorte por data e status, cortado em p_row_limit pelos mais recentes.
-- LIMIT NULL no Postgres significa "sem limite". A ordem importa: o corte vem
-- ANTES dos filtros de origem/assunto/provedor, replicando o caminho antigo.
candidatos as (
  select
    coalesce(e."messageId", e.id::text) as chave,
    e."messageId",
    lower(btrim(e.destination)) as destinatario,
    e."timestamp",
    e.subject,
    public.seslock_event_type(e."eventType", e."notificationType") as tipo,
    public.seslock_origin_label(e."snsTopicArn", e."sourceArn", e."fromAddress", e.source, e.subject) as origem,
    lower(btrim(split_part(e.destination, '@', 2))) as dominio,
    coalesce(
      nullif(btrim(e."bounceSubType"), ''),
      nullif(btrim(e."bounceType"), ''),
      nullif(btrim(e."diagnosticCode"), ''),
      nullif(btrim(e."complaintFeedbackType"), ''),
      'N/A'
    ) as motivo,
    public.seslock_normalize_text(concat_ws(' ',
      e.id::text, e."messageId", e."snsMessageId", e.subject, e.source, e."fromAddress",
      host(e."sourceIp"), e."callerIdentity", e."configurationSet", e."projectTag",
      e."sourceArn", e."snsTopicArn", e."eventType", e."notificationType",
      e."bounceType", e."bounceSubType", e."diagnosticCode", e."reportingMta",
      host(e."remoteMtaIp"), e."smtpResponse", e."complaintFeedbackType",
      e.destination, e.destinations, e."bouncedRecipients", e."complainedRecipients"
    )) as texto_busca
  from public.aws_sns e
  where e."timestamp" >= p_start
    and (p_end is null or e."timestamp" <= p_end)
    and (p_status = 'all'
         or public.seslock_event_type(e."eventType", e."notificationType") = p_status)
  order by e."timestamp" desc
  limit p_row_limit
),
filtrado as (
  select c.* from candidatos c, params p
  where (p.q_subject = ''
         or public.seslock_normalize_text(c.subject) like '%' || p.q_subject || '%')
    and (p.q_provider = ''
         or c.dominio = p.q_provider
         or c.dominio like '%.' || p.q_provider
         or p.q_provider like '%.' || c.dominio)
    and (p.q_origin = '' or c.texto_busca like '%' || p.q_origin || '%')
),
-- Réplica do computeAverageDeliveryTimeMs: primeiro envio e primeira entrega
-- por chave, só pares coerentes entram na média. NÃO é
-- avg("deliveryProcessingTimeMillis"), que é outra métrica.
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
-- Mesma regra do buildEventTimeSeries: até 3 dias agrupa por hora, acima por
-- dia. Baldes alinhados em UTC porque o JS usa Math.floor(ts / bucketMs), que
-- é epoch puro — o fuso da sessão deslocaria as barras.
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
-- Cortes em 8 e desempate alfabético replicam o slice(0, 8) e a ordenação do
-- JS. Sem o desempate a ordem é indeterminada e os cards trocam de posição
-- entre execuções idênticas.
provedores as (
  select dominio, count(*) as total,
         count(*) filter (where tipo = 'delivered') as entregues,
         count(*) filter (where tipo = 'bounced') as bounces
  from filtrado where dominio <> ''
  group by dominio order by total desc, dominio asc limit 8
),
motivos as (
  select motivo, count(*) as total
  from filtrado where tipo = 'bounced'
  group by motivo order by total desc, motivo asc limit 8
),
origens as (
  select origem, count(*) as total
  from filtrado group by origem order by total desc, origem asc limit 8
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
  -- Denominador é sentCount quando há envios; só cai para o total quando não
  -- há nenhum 'sent' na janela. Dividir sempre pelo total trocaria 96% por 45%.
  'deliveryRate', case
                    when t.enviados > 0 then round(100.0 * t.entregues / t.enviados, 2)
                    when t.total_eventos > 0 then round(100.0 * t.entregues / t.total_eventos, 2)
                    else null end,
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

-- ---------------------------------------------------------------------------
-- overview_events
-- ---------------------------------------------------------------------------
-- Página da lista "Atividade recente", com filtro, ordenação e contagem no
-- banco. Antes, exibir 50 linhas custava baixar até 20.000, porque os filtros
-- de origem/assunto/provedor rodavam em JS e o navegador precisava de todas as
-- candidatas para depois fatiar.
--
-- Usa join adiado: o filtro e a ordenação trabalham só com id, timestamp e
-- destinatário, e as colunas gordas são buscadas depois, para as 50 linhas que
-- sobraram. Sem isso, o CTE materializava as 99 mil linhas inteiras — com o
-- raw_payload de ~3,7 KB cada — num arquivo temporário, para no fim usar 50.
create or replace function public.overview_events(
  p_start     timestamptz,
  p_end       timestamptz default null,
  p_status    text default 'all',
  p_origin    text default '',
  p_subject   text default '',
  p_provider  text default '',
  p_sort      text default 'time-desc',
  p_limit     int default 50,
  p_offset    int default 0,
  p_row_limit int default null
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
candidatos as (
  select e.id, e."timestamp", e.subject,
         lower(btrim(e.destination)) as ordenavel,
         lower(btrim(split_part(e.destination, '@', 2))) as dominio,
         public.seslock_normalize_text(concat_ws(' ',
           e.id::text, e."messageId", e."snsMessageId", e.subject, e.source, e."fromAddress",
           host(e."sourceIp"), e."callerIdentity", e."configurationSet", e."projectTag",
           e."sourceArn", e."snsTopicArn", e."eventType", e."notificationType",
           e."bounceType", e."bounceSubType", e."diagnosticCode", e."reportingMta",
           host(e."remoteMtaIp"), e."smtpResponse", e."complaintFeedbackType",
           e.destination, e.destinations, e."bouncedRecipients", e."complainedRecipients"
         )) as texto_busca
  from public.aws_sns e
  where e."timestamp" >= p_start
    and (p_end is null or e."timestamp" <= p_end)
    and (p_status = 'all'
         or public.seslock_event_type(e."eventType", e."notificationType") = p_status)
  order by e."timestamp" desc
  limit p_row_limit
),
chaves as (
  select c.id, c."timestamp", c.ordenavel
  from candidatos c, params p
  where (p.q_subject = ''
         or public.seslock_normalize_text(c.subject) like '%' || p.q_subject || '%')
    and (p.q_provider = ''
         or c.dominio = p.q_provider
         or c.dominio like '%.' || p.q_provider
         or p.q_provider like '%.' || c.dominio)
    and (p.q_origin = '' or c.texto_busca like '%' || p.q_origin || '%')
),
-- O desempate por destinatário replica o sortRecentEvents do JS, que usa o
-- e-mail como critério secundário para a ordem não variar entre execuções.
pagina as (
  select id, row_number() over () as posicao
  from (
    select id from chaves
    order by
      case when p_sort = 'time-asc'       then "timestamp" end asc nulls last,
      case when p_sort = 'recipient-asc'  then ordenavel   end asc nulls last,
      case when p_sort = 'recipient-desc' then ordenavel   end desc nulls last,
      case when p_sort not in ('time-asc','recipient-asc','recipient-desc')
           then "timestamp" end desc nulls last,
      ordenavel asc
    limit greatest(p_limit, 0) offset greatest(p_offset, 0)
  ) ordenado
)
select jsonb_build_object(
  'totalCount', (select count(*) from chaves),
  -- Mesmas colunas de EMAIL_EVENT_LIST_COLUMNS: o rowToEmailEvent do frontend
  -- segue sendo o único lugar que sabe transformar linha em EmailEvent.
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
$fn$;

comment on function public.overview_events is
  'Página de eventos do SES com filtros, ordenação e contagem total feitos no banco. Respeita a RLS de quem chama.';
