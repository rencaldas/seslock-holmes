-- Corrige o colapso de performance do Overview.
-- Já aplicada no projeto padrão; versionada aqui para o repositório refletir o
-- estado real do banco.
--
-- SINTOMA: o painel caía com "Algo deu errado". As funções levavam de 3 a 23
-- segundos para a mesma consulta e estouravam o statement_timeout de 8s do
-- papel `authenticated`.
--
-- Foram DUAS causas somadas, e a segunda fui eu que introduzi tentando
-- consertar um aviso de lint.
--
-- CAUSA 1 — o planejador lê colunas que a consulta menciona, mesmo que o
-- predicado nunca seja avaliado. As decisões de quais colunas buscar são
-- tomadas ANTES de executar, então curto-circuito com OR e CASE evitam o
-- processamento, mas não a leitura. Bastava a consulta citar `subject` ou
-- `diagnosticCode` para o Postgres ir ao heap de 460 MB nas 99 mil linhas,
-- mesmo sem filtro nenhum: ~76 mil buffers por chamada.
--
--   Solução: montar o texto da consulta em runtime (plpgsql + EXECUTE). No
--   caminho sem filtros a consulta não menciona essas colunas, e o índice
--   aws_sns_overview_cover4_idx cobre o resto — vira Index Only Scan.
--
-- CAUSA 2 — o PostgreSQL não faz inline de função SQL que tenha cláusula SET.
-- A migration 20260801160000 adicionou `SET search_path` às quatro funções
-- auxiliares para calar o linter, e com isso cada expressão barata virou uma
-- chamada de função real, executada 98 mil vezes por consulta. Sozinho, isso
-- custava ~10 segundos: mesmo com o I/O já resolvido pelo índice, a função
-- seguia em 12s.
--
--   Solução: remover a cláusula SET e qualificar todas as referências internas
--   com o schema. `pg_catalog.lower` não tem como ser sequestrado, e sem o SET
--   o planejador volta a inlinar.
--
--   Consequência conhecida: o linter volta a marcar as quatro como
--   "function_search_path_mutable". É falso positivo — ele verifica a presença
--   da cláusula, não se os nomes estão qualificados. Trocar 10 segundos de
--   latência por um aviso não compensa.
--
-- RESULTADO MEDIDO:
--   overview_analytics  12,3s -> 2,1s   (buffers 76.575 -> 11.327)
--   overview_events     11,0s -> 0,3s
--
-- LIÇÃO: medir uma execução isolada com cache quente não diz nada sobre o
-- comportamento real. Todas as medições anteriores desta sequência (3,0s /
-- 2,8s) eram amostras únicas e não se sustentaram — a mesma função variou de
-- 3s a 23s. E nenhuma delas foi confrontada com o statement_timeout da
-- plataforma, que é o limite que de fato importa.

-- Índice de cobertura do caminho rápido. `id` precisa estar aqui: a expressão
-- coalesce("messageId", id) o referencia, e sem ele o Index Only Scan é
-- impossível — o planejador descartava o índice inteiro e voltava ao heap.
--
-- Ficam DELIBERADAMENTE de fora, ambos medidos antes:
--   diagnosticCode chega a 2103 caracteres nesta base, perto do limite de
--   entrada do btree; indexá-lo arriscaria fazer o INSERT falhar e quebrar a
--   ingestão do SNS. Ele só é o terceiro fallback do motivo do bounce, e ZERO
--   dos 3.848 bounces dependem dele — todos têm bounceType ou bounceSubType.
--   subject tem 133 caracteres hoje, mas o SES permite muito mais.
create index if not exists aws_sns_overview_cover4_idx
  on public.aws_sns ("timestamp" desc)
  include (id, "eventType", "notificationType", "messageId", destination,
           "snsTopicArn", "sourceArn", "fromAddress", source,
           "bounceType", "bounceSubType", "complaintFeedbackType");

drop index if exists public.aws_sns_overview_cover_idx;
drop index if exists public.aws_sns_overview_cover2_idx;
drop index if exists public.aws_sns_overview_cover3_idx;

-- Auxiliares sem cláusula SET, com nomes qualificados, para voltarem a ser
-- inlináveis. Ver CAUSA 2 acima.
create or replace function public.seslock_normalize_text(value text)
returns text language sql stable parallel safe as $$
  select coalesce(pg_catalog.lower(public.unaccent(pg_catalog.btrim(value))), '')
$$;

create or replace function public.seslock_event_type(event_type text, notification_type text)
returns text language sql immutable parallel safe as $$
  select case pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.btrim(coalesce(event_type, notification_type, ''))),
           '\s+', '_', 'g')
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

create or replace function public.seslock_summarize_arn(value text)
returns text language sql immutable parallel safe as $$
  select pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(coalesce(pg_catalog.btrim(value), ''), '^.*:', ''),
         '^.*/', '')
$$;

create or replace function public.seslock_origin_label(
  sns_topic_arn text, source_arn text, from_address text, source text, subject text
) returns text language sql immutable parallel safe as $$
  select coalesce(
    nullif(public.seslock_summarize_arn(sns_topic_arn), ''),
    nullif(public.seslock_summarize_arn(source_arn), ''),
    nullif(pg_catalog.btrim(coalesce(from_address, '')), ''),
    nullif(pg_catalog.btrim(coalesce(source, '')), ''),
    nullif(pg_catalog.btrim(coalesce(subject, '')), ''),
    'Origem desconhecida'
  )
$$;

-- O statement_timeout havia sido subido para 30s como paliativo enquanto as
-- funções passavam de 8s. Com a correção elas voltaram para ~2,1s e ~0,3s, e o
-- limite volta ao padrão: uma consulta que passe de 8s no caminho do usuário é
-- sintoma de regressão, e é melhor que falhe alto do que degrade em silêncio.
alter role authenticated set statement_timeout = '8s';

-- As funcoes overview_analytics e overview_events foram reescritas em plpgsql
-- com SQL dinamico. Como o corpo e extenso, ele esta na migration seguinte
-- (20260801180100), separado para esta ficar legivel.
