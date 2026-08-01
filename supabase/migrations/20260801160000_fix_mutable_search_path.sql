-- Fixa o search_path das funções que estavam sem ele.
-- Já aplicada no projeto padrão; versionada aqui para o repositório refletir o
-- estado real do banco.
--
-- Uma função sem search_path fixo resolve nomes na hora da chamada, usando o
-- caminho de quem chamou. Quem conseguir criar um objeto num schema que venha
-- antes na busca pode sequestrar uma chamada — trocar `unaccent` ou `lower`
-- por uma versão própria, por exemplo. Aqui o risco é baixo porque todas são
-- SECURITY INVOKER (rodam com o privilégio de quem chama, não escalam nada),
-- mas fechar é gratuito e cala o linter do Supabase.
--
-- As quatro seslock_* vieram da 20260801040000: eu havia colocado
-- `set search_path` nas duas funções principais e esquecido nas auxiliares.
-- As duas de agendamento são anteriores e tinham o mesmo problema.
--
-- pg_catalog vem primeiro para os nomes internos não poderem ser sombreados;
-- public em seguida porque é onde vive a extensão unaccent.
--
-- Nota sobre unaccent no schema public: o linter também sinaliza isso, e a
-- correção "correta" seria movê-la para um schema próprio. Não foi feito de
-- propósito — seslock_normalize_text a chama sem qualificar, então mover a
-- extensão quebraria a função. Trocar um aviso de baixo risco por um painel
-- fora do ar não compensa; se for mexer um dia, mova a extensão e qualifique
-- a chamada na mesma migration.

alter function public.seslock_normalize_text(text)
  set search_path = pg_catalog, public;

alter function public.seslock_event_type(text, text)
  set search_path = pg_catalog, public;

alter function public.seslock_summarize_arn(text)
  set search_path = pg_catalog, public;

alter function public.seslock_origin_label(text, text, text, text, text)
  set search_path = pg_catalog, public;

alter function public.compute_next_run_at(jsonb, text, timestamptz)
  set search_path = pg_catalog, public;

alter function public.report_schedules_set_next_run_at()
  set search_path = pg_catalog, public;
