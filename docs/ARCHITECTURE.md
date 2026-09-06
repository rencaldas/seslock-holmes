# Arquitetura

Este documento explica **como** as peças não óbvias do Seslock Holmes funcionam e **por quê** foram construídas assim. É o destino dos comentários de código que precisavam de parágrafos inteiros para contar uma decisão — o código mantém um ponteiro curto para a seção correspondente aqui.

Ver também [SECURITY.md](./SECURITY.md) para o modelo de segurança (RLS, tokens, autenticação) e [README.md](./README.md) para o índice geral da documentação técnica.

## Sumário

- [Fluxo de dados: Postgres como fonte da verdade](#fluxo-de-dados-postgres-como-fonte-da-verdade)
- [Overview: agregação no banco via RPC](#overview-agregação-no-banco-via-rpc)
- [O seletor de linhas legado e a armadilha que ele deixou](#o-seletor-de-linhas-legado-e-a-armadilha-que-ele-deixou)
- [Comparação com período anterior](#comparação-com-período-anterior)
- [RBAC leve: viewer e manager](#rbac-leve-viewer-e-manager)
- [Relatórios agendados](#relatórios-agendados)
- [Compartilhamento de dashboard](#compartilhamento-de-dashboard)
- [Log de auditoria](#log-de-auditoria)
- [Convenções de infraestrutura (Vercel)](#convenções-de-infraestrutura-vercel)
- [Referência: códigos de erro do PostgREST/PostgreSQL](#referência-códigos-de-erro-do-postgrestpostgresql)

---

## Fluxo de dados: Postgres como fonte da verdade

O painel não guarda estado de negócio fora do Supabase/PostgreSQL. Toda leitura de eventos, agendamento ou link compartilhado é uma consulta ou RPC contra o banco; o frontend só formata e filtra o que já veio pronto.

Duas famílias de acesso convivem:

- **Direto-Supabase (supabase-js)**: usado sempre que o usuário está autenticado no navegador — leitura de eventos, RBAC, links de compartilhamento, agendamentos de um projeto Supabase próprio.
- **Via `/api/*` com `ADMIN_API_TOKEN`**: usado só para gerenciar `report_schedules` **do projeto padrão desta implantação** (o Supabase que este deploy da Vercel aponta por padrão). Antes da migration `20260730140000_lock_default_report_schedules.sql`, qualquer visitante do site, sem login, podia gravar agendamentos diretamente no projeto Supabase do dono usando a chave anon do bundle público — e o cron compartilhado enviaria o e-mail pela própria conta Gmail do dono. A migration bloqueia o papel `anon` por completo nessa tabela **só no projeto padrão**; visitantes com Supabase próprio continuam com a RLS portável (`20260730120000`, anon-writable) e falam direto via supabase-js. Por isso o CRUD do projeto padrão passa pelas funções serverless em `frontend/api/`, autenticadas por `ADMIN_API_TOKEN` (ver [SECURITY.md § Tokens de administração e cron](./SECURITY.md#tokens-de-administração-e-cron)).

`dashboard_shares` **nunca** permitiu escrita do papel `anon` em nenhum dos dois casos (migration `20260802120000`), então não existe um desvio equivalente via `/api` para links — o CRUD é sempre direto-Supabase.

Consequência prática para quem lê o código: `frontend/src/lib/scheduled-reports/queries.ts` (direto-Supabase) e `frontend/src/lib/scheduled-reports/admin-queries.ts` (via `/api/schedules.ts`) implementam a mesma interface para as duas situações acima — qual delas é usada depende de `isDefaultProject` em `SupabaseContext` (ver `frontend/src/lib/supabase/context.tsx`).

## Overview: agregação no banco via RPC

Os indicadores da Visão Geral (distribuição de status, reputação, taxa de bounce, tempo médio de entrega etc.) são calculados por uma função Postgres, `overview_analytics`, chamada via RPC em `frontend/src/lib/supabase/queries/overview-aggregate.ts`.

**Por que não em JS**: a versão anterior baixava até 20.000 eventos em lotes de 1000 (20 idas e voltas sequenciais) e somava tudo no navegador. Além de lento, o número saía errado sempre que o período filtrado tinha mais eventos que o teto: com 99 mil eventos em 30 dias, o teto cobria só os 8 dias mais recentes, e a taxa de bounce exibida (2,53%) não era a do período selecionado (3,01%). O rótulo dizia "30 dias", o dado era de 8. A RPC devolve ~50 linhas já agregadas, exatas sobre 100% da janela.

**Preenchimento de gaps do gráfico é feito em JS, não SQL** (`fillTimeSeriesGaps`): o SQL só agrupa baldes que têm eventos; se o JS não preenchesse os intervalos vazios, o gráfico desenharia uma linha contínua entre dois dias distantes, escondendo visualmente que não houve nenhum envio no meio.

**`bounceSubType` no rótulo de status vem cru do SES** — a tradução para o texto exibido na UI acontece no frontend, não no SQL (ver `frontend/src/lib/overview/analytics.ts`). Os subtipos `open`/`click` do SES sempre aparecem zerados nos indicadores: o SES emite esses eventos, mas a tabela de eventos usada por este painel não os recebe — isso não é um bug do agregador.

**Paginação da lista "Atividade recente" também é no banco** (`fetchOverviewEventsPage` / RPC `overview_events`), incluindo os filtros de origem, assunto e provedor. Antes, exibir 50 linhas custava baixar até 20.000 candidatas para o navegador filtrar e fatiar.

**O parâmetro `p_bounce_subtype` é condicional a uma migration** (`20260801190000_overview_bounce_subtype_filter.sql`). Enviá-lo antes de a migration existir no banco em uso faz o PostgREST recusar a chamada inteira (função com essa assinatura não existe no schema cache), quebrando o Overview inteiro — não só quem filtra por bounce. Ele fica comentado no código até a migration ser considerada garantida em todos os ambientes suportados; reative com `p_bounce_subtype: input.bounceSubType` quando isso acontecer.

## O seletor de linhas legado e a armadilha que ele deixou

`rowLimit`/`ROW_LIMIT_OPTIONS` existiam como válvula de performance do navegador: impediam que a página baixasse a tabela inteira antes da agregação migrar para RPC (ver seção anterior). Esse motivo não existe mais — a agregação roda no banco, e "sem limite" custa ~3,5 KB a mais de tráfego que "100 linhas".

O que sobrou dele era uma armadilha ativa: com 100 linhas, os cartões do Overview mostravam bounce rate 0% quando o valor real do período era 3%, porque a amostra de 100 linhas cobria só os últimos minutos. **Um filtro de período que devolve a taxa de outro período é pior que nenhum filtro.** Por isso `p_row_limit` é deliberadamente **não repassado** em `fetchOverviewEventsPage`/`fetchOverviewAggregate` — o padrão `null` da função Postgres significa "sem teto", e o painel sempre reflete a janela inteira escolhida pelo usuário.

O seletor continua tendo uma função real, só que em outro lugar: limitar o tamanho do arquivo gerado no relatório CSV/PDF (ver `loadReportEvents` em `overview-page.tsx`), onde cortar linhas é uma decisão legítima de tamanho de arquivo, não de correção do indicador.

Separadamente, existe um **teto de segurança incondicional de 20.000 linhas** (`UNLIMITED_ROW_LIMIT_CAP` em `frontend/src/lib/row-limits.ts`) aplicado quando o usuário escolhe "sem limite" nesse seletor de relatório — sem ele, a busca pagina a tabela inteira em lotes de 1000 e trava a aba do navegador conforme a base de eventos cresce. Esse teto é aplicado num único ponto (`fetchEventRowsWithTimeFallback`), valendo para Overview, investigação por destinatário e relatórios agendados igualmente. Quando atingido, o resultado sai truncado, e isso precisa ficar visível na UI (`TruncationNotice`): numa ferramenta de investigação, truncar em silêncio pode levar alguém a concluir "não há mais bounces para este destinatário" quando há.

## Comparação com período anterior

O toggle "vs período anterior" no Overview (desligado por padrão, por custo de uma query extra) reaproveita a mesma RPC `overview_analytics` com limites (`p_start`/`p_end`) deslocados para trás pela mesma duração da janela atual, em vez de estender a assinatura da função com um parâmetro novo — alargar a RPC correria o mesmo risco descrito acima para `p_bounce_subtype` (quebrar o Overview inteiro se a migration não estiver aplicada em todos os ambientes).

`resolveClosedTimeRange` (`frontend/src/lib/time-filters.ts`) existe separado de `resolveTimeRange` porque o cálculo do período anterior precisa de um fim **explícito** (`asOf`) para os dois períodos — em modo "window" o fim aberto normalmente vira "agora" no momento em que a query roda no banco, o que tornaria a duração dos dois períodos ambígua.

## RBAC leve: viewer e manager

Desde a migration `20260814090000_user_roles_rbac.sql`, toda conta autenticada tem um papel: `viewer` ou `manager`. Viewers só visualizam; managers também criam/editam agendamentos e links de compartilhamento. Contas novas começam como `viewer`.

A RPC `current_user_role` (chamada por `frontend/src/lib/user-roles/queries.ts`) é a fonte de verdade. Se ela não existir ainda no projeto em uso (código PostgREST `PGRST202`, "função não encontrada no schema cache" — a migration não foi aplicada), o fallback é **`manager`**, nunca `viewer`: antes desta migration, todo usuário `authenticated` tinha CRUD completo, então um projeto self-hosted que ainda não migrou não pode perder acesso silenciosamente no primeiro deploy deste código.

O hook `useUserRole` (`frontend/src/lib/user-roles/use-user-role.ts`) é **só UX** — esconde/mostra botões que, sem RBAC no servidor, dariam 403. A aplicação real do controle de acesso é a RLS no banco; ver [SECURITY.md § Modelo de acesso](./SECURITY.md#modelo-de-acesso-rls-é-a-fonte-da-verdade). Por isso o hook assume `manager` como valor otimista enquanto a consulta carrega (melhor mostrar um botão que raramente dá 403 do que esconder uma ação de quem sempre teve acesso), e usa `staleTime` de 5 minutos (o papel de alguém não muda no meio de uma sessão sem uma ação administrativa fora do app).

## Relatórios agendados

### Dois gatilhos, uma proteção contra corrida

O envio periódico roda via **workflow do GitHub Actions** a cada 15 minutos (`.github/workflows/scheduled-reports-trigger.yml`), com o **cron da Vercel** (uma vez por dia, `vercel.json`) como reforço/failsafe. Os dois chamam `/api/send-scheduled-reports` e autenticam com `CRON_SECRET`. O Supabase só guarda os dados — não há `pg_cron`/`pg_net`/Vault configurado no lado do banco.

Como dois disparos podem, em teoria, coincidir, `runDueSchedules` usa um mecanismo de **claim otimista**: antes de processar um agendamento vencido, ele empurra `next_run_at` alguns minutos para frente (evitando que o segundo tick pegue o mesmo agendamento), e só depois sobrescreve com o valor real calculado por `compute_next_run_at`. O disparo manual ("forçar agora", `run-schedule-now.ts`/`recordLastRunOnly`) **nunca** toca `next_run_at` — forçar um envio não pode interferir na cadência normal do agendamento.

### Por que Gmail SMTP, e não uma API transacional

APIs transacionais (SendGrid, SES, Postmark, etc.) exigem verificar um domínio próprio do remetente, o que não é uma opção neste contexto de projeto auto-hospedável. O limite diário do Gmail (~500 e-mails/dia numa conta regular) cobre confortavelmente um punhado de relatórios agendados.

Uma consequência real desse SMTP: o logo do cabeçalho do e-mail é servido como asset estático (`public/email-logo.png`), **não** embutido como `data:` URI. Um data URI parecia mais simples (autocontido, sem depender do domínio estar no ar), mas o renderizador do próprio Gmail — o cliente que esta funcionalidade mais precisa suportar — não exibe `data:image` inline de forma confiável: em produção o cabeçalho aparecia como uma caixa de imagem quebrada, mesmo a mesma HTML renderizando certo num preview de iframe de navegador comum.

O corpo do e-mail é montado com layout de tabelas (compatibilidade ampla entre clientes de e-mail) e sempre inclui uma versão em texto puro além do HTML — pular o texto puro penaliza a pontuação de spam do e-mail.

### Onde este módulo vive, e por quê

`frontend/src/lib/scheduled-reports/report-runner.ts` concentra a lógica reaproveitada pelos dois endpoints (`api/send-scheduled-reports.ts` e `api/run-schedule-now.ts`) e vive em `src/lib`, não em `api/`, de propósito: o builder de Serverless Functions da Vercel **exclui do bundle qualquer arquivo ou pasta cujo nome comece com `_`**, não apenas do roteamento. Uma tentativa anterior de colocar esse módulo em `api/_lib/` fez os dois endpoints falharem em runtime com "Cannot find module". `src/lib` já é conhecido-bom: é onde `email-report.ts` e os demais módulos reutilizados já vivem, e são corretamente rastreados e incluídos pelo bundler Node da Vercel via imports relativos a partir de `api/*.ts`.

Essa é também a razão de **todos os imports dentro de `api/*.ts` e dos módulos de `src/lib` que eles reutilizam serem relativos, com extensão `.js` explícita** (ex.: `../supabase/aws-sns.js`), em vez do alias `@/` usado no resto do frontend: o bundler de funções Node da Vercel não resolve esse alias do `tsconfig`, e o runtime ESM do Node exige a extensão do arquivo de saída (`.js`), não a do arquivo fonte (`.ts`).

### O e-mail de relatório tem um PDF gerado à mão

`frontend/src/lib/email-report.ts` não usa uma biblioteca de PDF — o motor de layout (colunas, quebra de página, cursor de posição) foi escrito diretamente sobre a API de baixo nível do gerador de PDF usado no projeto. `columnRow` avança o cursor compartilhado da página uma única vez, pela altura da coluna mais alta entre as colunas daquela linha — não pela altura de cada coluna individualmente.

A categorização de eventos problemáticos no relatório usa uma lista ordenada de regras onde **a primeira regra que casar vence** — reordenar essa lista muda silenciosamente para qual categoria um evento ambíguo cai.

O nome do arquivo do relatório (`createEmailReportFilename`) é sempre formatado no horário de Brasília, independentemente do fuso horário da máquina que gera o relatório (a máquina de quem exporta manualmente, ou o servidor da função serverless).

## Compartilhamento de dashboard

Ver [SECURITY.md § Links de compartilhamento](./SECURITY.md#links-de-compartilhamento) para o modelo de token. Em termos de arquitetura: a página pública `/share/:token` não tem acesso a Configurações nem sessão, então a URL do link carrega `url`/`key`/`table` do projeto Supabase de origem como query params — sem isso, o app não saberia a qual projeto se conectar antes mesmo de chamar `get_shared_dashboard`.

**Regenerar um link** (`regenerateDashboardShareToken`) existe porque não há forma de recuperar o texto puro de um link já criado — só o hash fica salvo. "Perdi o link" só tem uma saída: gerar um token novo para a mesma linha (mantendo nome, filtros e validade), o que invalida o link antigo de propósito. Quem ainda tiver a URL perdida também perde o acesso — o mesmo modelo de "esqueci minha senha".

## Log de auditoria

Desde a migration `20260814100000_audit_log.sql`, toda ação administrativa relevante (criar/editar/pausar/excluir/forçar um agendamento, resultado de um envio automático, criar/revogar/regenerar um link de compartilhamento) grava uma entrada em `audit_log`, somente-leitura e visível a qualquer usuário autenticado — não é uma feature exclusiva de manager.

Duas rotas escrevem no log:

- **Direto-Supabase** (`frontend/src/lib/audit-log/queries.ts`, função `recordAuditEvent`): chama a RPC `record_audit_event`, que resolve o ator a partir do JWT da própria sessão (`auth.uid()`/e-mail) — nunca de um valor mandado pelo cliente. Ver [SECURITY.md § Log de auditoria e origem do ator](./SECURITY.md#log-de-auditoria-e-origem-do-ator).
- **Servidor** (`frontend/src/lib/audit-log/record-server.ts`), usada pelo cron e pelo "forçar agora": grava direto na tabela (não via RPC, já que não há `auth.uid()` num contexto de função serverless rodando com a service role key), identificando o ator como `"cron"` ou como o admin que forçou o envio.

Em ambos os casos, uma falha ao gravar o log **nunca** deve impedir a ação real (criar um agendamento, enviar um relatório) de ser considerada bem-sucedida — por isso `recordAuditEvent`/`recordAuditEventFromServer` engolem o próprio erro e só logam no console.

O campo `metadata` nunca inclui a lista de destinatários (`recipients`) de um agendamento — só a contagem (`recipientCount`). Isso é deliberado por privacidade (ver a nota de PII na migration), não uma omissão.

## Convenções de infraestrutura (Vercel)

- **Pastas com `_` são excluídas do bundle de Serverless Functions**, não só do roteamento — ver a explicação completa em [Relatórios agendados § Onde este módulo vive](#onde-este-módulo-vive-e-por-quê).
- **O bundler Node da Vercel não resolve o alias `@/`**. Todo código que roda em `frontend/api/*.ts` (e os módulos de `src/lib` que ele importa) usa import relativo com extensão `.js`.
- **A extensão `.js` no import é obrigatória, mesmo o arquivo fonte sendo `.ts`.** `@vercel/node` transpila cada arquivo individualmente e os despacha como `.js` separados (não empacota tudo num único arquivo); os imports relativos são então resolvidos pelo loader ESM do próprio Node em runtime, que — ao contrário de um bundler — exige a extensão explícita do arquivo de saída. Omitir a extensão produz `Error [ERR_MODULE_NOT_FOUND]` em produção. Isso já foi confundido com um problema de import estático vs. dinâmico (`await import(...)` foi tentado em `run-schedule-now.ts` na teoria de que adiar o import para dentro de um try/catch transformaria um crash de carregamento de módulo em erro capturável) — não era o problema real, e nada no topo dos módulos de `report-runner.ts` lança exceção ao carregar, então não há risco de crash-on-load a evitar com import dinâmico aqui.
- **`vite.config.ts` evita `import pkg from "package.json"`** para não vazar o manifesto completo de dependências (produção e desenvolvimento) no bundle público servido ao navegador.
- Os testes e2e (Playwright) rodam contra um `static-server.mjs` próprio, não `vite preview`, porque só o primeiro aplica os cabeçalhos HTTP reais definidos em `vercel.json` (necessários para os testes de CSP).

## Referência: códigos de erro do PostgREST/PostgreSQL

Vários módulos decodificam os mesmos códigos de erro do PostgREST/Postgres para distinguir "recurso ainda não migrado neste projeto" de um erro de verdade. Em vez de repetir a explicação em cada arquivo, esta é a referência única:

| Código | Significado | Onde aparece |
|---|---|---|
| `42501` | `insufficient_privilege` — RLS negou o acesso | `lib/supabase/auth.ts` (`isPermissionDeniedError`) |
| `PGRST301` | JWT ausente ou expirado no PostgREST | `lib/supabase/auth.ts` (`isPermissionDeniedError`) |
| `42P01` | `undefined_table` — a tabela/view não existe neste banco (migration não aplicada) | `lib/dashboard-shares/queries.ts`, `lib/audit-log/queries.ts`, `lib/scheduled-reports/queries.ts` |
| `PGRST202` | Função RPC não encontrada no schema cache (migration não aplicada) | `lib/user-roles/queries.ts` |

O padrão em todos os casos acima é o mesmo: capturar o código específico de "ainda não migrado" e degradar graciosamente (RBAC cai para `manager`, seções de auditoria/compartilhamento se escondem), deixando qualquer outro código estourar como erro real.
