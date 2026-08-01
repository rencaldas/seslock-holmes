-- Faz a recusa de acesso ser explícita em vez de silenciosa.
-- Já aplicada no projeto padrão; versionada aqui para o repositório refletir
-- o estado real do banco.
--
-- ATENÇÃO — esta migration não é opcional nem cosmética. Sem ela, a tela de
-- login do app nunca aparece, e o painel fica inutilizável para quem não
-- tiver sessão, sem nenhum caminho para entrar.
--
-- O motivo é uma suposição errada sobre como a RLS falha. Ela NÃO gera erro
-- em SELECT: quando nenhuma policy casa com o papel, o PostgREST responde 200
-- com uma lista vazia. Para o app isso é indistinguível de "não há eventos no
-- período" — então isPermissionDeniedError (src/lib/supabase/auth.ts) nunca
-- disparava, a tela de login nunca era montada, e o usuário ficava olhando um
-- painel vazio sem saber que o problema era falta de autenticação.
--
-- Revogar o GRANT no nível da tabela muda isso: o Postgres passa a devolver
-- 42501 "permission denied for table", que é um erro de verdade e chega ao
-- cliente como tal.
--
-- Nenhum acesso é perdido — a RLS de 20260801015212 já bloqueava essas linhas
-- para anon. A diferença é erro explícito no lugar de vazio silencioso, que é
-- o comportamento correto numa ferramenta de investigação: um resultado vazio
-- sem aviso leva alguém a concluir que não existem bounces para um
-- destinatário quando na verdade não havia permissão para vê-los.
--
-- Se algum dia o login parar de aparecer, confira primeiro se estes GRANTs
-- voltaram (o painel do Supabase os recria ao usar alguns assistentes de
-- configuração):
--
--   select has_table_privilege('anon','public.aws_sns','SELECT');  -- deve ser false

revoke select on public.aws_sns from anon;
revoke select, insert, update, delete on public.report_schedules from anon;
revoke select, insert, update, delete on public.report_schedule_runs from anon;
