-- Fecha o acesso anônimo aos eventos do SES e aos agendamentos de relatório.
-- Já aplicada no projeto padrão; versionada aqui para que o repositório
-- reflita o estado real do banco.
--
-- Contexto — por que 20260730140000 não bastou:
--
-- Aquela migration dropa a policy "Anon can manage report schedules", que é o
-- nome criado por 20260730120000. Depois disso, porém, o projeto ganhou
-- policies anônimas criadas à mão pelo painel do Supabase, que gera uma por
-- comando com outros nomes ("Anon can create/view/update/delete report
-- schedules"). Como os nomes não batem, a trava passou por elas sem efeito.
--
-- E o mesmo tipo de descompasso atingiu aws_sns: a policy-template padrão
-- "Enable read access for all users" (anon, using true) permaneceu ao lado da
-- policy nova de `authenticated`. Policies permissivas são combinadas com OR,
-- não AND, então o anon seguia lendo a tabela inteira e a proteção não valia
-- nada. Verificado depois com `set local role anon`: 0 linhas visíveis.
--
-- Por que report_schedules era o buraco mais grave:
--
-- Escrita anônima ali contornava a RLS de aws_sns por completo. Qualquer
-- pessoa com a anon key — que vai dentro do bundle público — podia inserir um
-- agendamento com o próprio endereço em `recipients`; o cron então lê os
-- eventos com service role, que ignora RLS, monta o relatório e envia. Era
-- exfiltração de dados por outra porta, além do abuso da conta de e-mail.
--
-- Por que substituir em vez de só remover:
--
-- O app fala direto com o Supabase pela anon key quando há credenciais salvas
-- em Configurações (isDefaultProject = false). Remover sem pôr nada no lugar
-- quebraria a página de agendamentos — foi o que aconteceu quando essas
-- policies foram dropadas antes e precisaram ser restauradas às pressas. As
-- equivalentes em `authenticated` mantêm o app funcionando para quem está
-- logado e fecham o anon. O cron não é afetado em nenhum cenário, porque
-- service role ignora RLS.

drop policy if exists "Enable read access for all users" on public.aws_sns;

drop policy if exists "Anon can create report schedules" on public.report_schedules;
drop policy if exists "Anon can view report schedules"   on public.report_schedules;
drop policy if exists "Anon can update report schedules" on public.report_schedules;
drop policy if exists "Anon can delete report schedules" on public.report_schedules;
drop policy if exists "Anon can manage report schedules" on public.report_schedules;

-- `using (true)` é deliberado: qualquer pessoa do time que faz login pode
-- gerenciar os agendamentos. O cadastro público está desabilitado e as contas
-- são criadas por um administrador, então o conjunto de quem tem acesso é
-- controlado fora da RLS. O linter do Supabase sinaliza esta policy como
-- permissiva; é o modelo pretendido, não um descuido.
create policy "Authenticated can manage report schedules"
  on public.report_schedules
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Anon can read report schedule runs" on public.report_schedule_runs;

create policy "Authenticated can read report schedule runs"
  on public.report_schedule_runs
  for select
  to authenticated
  using (true);
