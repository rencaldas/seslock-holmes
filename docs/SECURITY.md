# Segurança

Este documento reúne o raciocínio de segurança por trás de decisões que não são óbvias lendo só o código — incluindo dois incidentes reais já corrigidos. É leitura obrigatória antes de mexer em autenticação, tokens, RLS, compartilhamento ou log de auditoria.

Ver também [ARCHITECTURE.md](./ARCHITECTURE.md) para como as peças se encaixam, e o [CHANGELOG](../frontend/CHANGELOG.md) para o histórico completo de correções de segurança já aplicadas.

## Sumário

- [Modelo de acesso: RLS é a fonte da verdade](#modelo-de-acesso-rls-é-a-fonte-da-verdade)
- [RLS não gera erro em SELECT — a pegadinha do GRANT](#rls-não-gera-erro-em-select--a-pegadinha-do-grant)
- [Incidente: comparação de tokens em tempo constante](#incidente-comparação-de-tokens-em-tempo-constante)
- [Tokens de administração e cron](#tokens-de-administração-e-cron)
- [Tela de login](#tela-de-login)
- [Links de compartilhamento](#links-de-compartilhamento)
- [Log de auditoria e origem do ator](#log-de-auditoria-e-origem-do-ator)
- [Guarda contra open redirect (navigation safety)](#guarda-contra-open-redirect-navigation-safety)
- [Segredos e variáveis de ambiente](#segredos-e-variáveis-de-ambiente)

---

## Modelo de acesso: RLS é a fonte da verdade

Toda decisão de acesso que importa é aplicada por Row Level Security no Postgres — nunca pelo frontend. Isso vale para três camadas independentes:

1. **Leitura de eventos SES** (`aws_sns`): a policy exige o papel `authenticated`.
2. **RBAC leve** (viewer/manager, migration `20260814090000`): controla quem pode escrever em `report_schedules` e `dashboard_shares`.
3. **Escopo do projeto padrão**: `report_schedules` bloqueia o papel `anon` por completo no projeto padrão desta implantação (migration `20260730140000`), forçando o CRUD via `/api/schedules.ts` com `ADMIN_API_TOKEN` — ver [Tokens de administração e cron](#tokens-de-administração-e-cron).

O hook `useUserRole` (`frontend/src/lib/user-roles/use-user-role.ts`) e a checagem `canShare` em `frontend/src/components/shell/topbar.tsx` são **só UX** — escondem botões que, sem a RLS correspondente, dariam 403. **Nunca** decida se uma operação é seguros com base nesses valores do lado do cliente; eles existem para não mostrar uma ação que o servidor recusaria, não para proteger nada.

## RLS não gera erro em SELECT — a pegadinha do GRANT

Este é o detalhe mais fácil de quebrar sem perceber ao mexer em `frontend/src/lib/supabase/auth.ts`.

Uma policy de RLS bem configurada **não** faz um `SELECT` sem permissão retornar erro. Quando nenhuma policy casa com o papel do requisitante, o PostgREST devolve **200 com uma lista vazia** — indistinguível de "não há eventos no período filtrado". Nesse cenário, `isPermissionDeniedError` nunca dispara, a tela de login nunca aparece, e quem não tem sessão fica preso num painel vazio, sem nenhum caminho para entrar.

O que faz a recusa virar um erro de verdade (`42501`, capturado por `isPermissionDeniedError`) é o **`GRANT` da tabela estar revogado para o papel `anon`** — ver a migration `20260801025740_revoke_anon_grants_to_surface_auth_error.sql`. A RLS sozinha não é suficiente; ela e o GRANT revogado trabalham juntos.

**Se a tela de login parar de aparecer**, suspeite disto antes de qualquer outra coisa:

```sql
select has_table_privilege('anon', 'public.aws_sns', 'SELECT'); -- deve ser false
```

Alguns assistentes de configuração no painel do Supabase recriam esses GRANTs silenciosamente ao editar policies pela UI.

O app também **não exige login sempre**, de propósito: quem aponta o painel para um Supabase próprio com a RLS aberta continua entrando direto, sem conta e sem configurar Auth — é justamente para permitir isso que existem os campos de URL/chave anon em Configurações. Exigir sessão incondicionalmente quebraria esse caso de uso.

## Incidente: comparação de tokens em tempo constante

`frontend/src/lib/server/request-auth.ts` valida os bearer tokens que protegem `ADMIN_API_TOKEN` (`api/schedules.ts`) e `CRON_SECRET` (`api/send-scheduled-reports.ts`, `api/run-schedule-now.ts`). Dois problemas reais já existiram aqui:

**1. Comparação `===` vaza tempo de resposta.** String comparison em JS interrompe no primeiro byte diferente, então o tempo de resposta de uma tentativa de autenticação revela quantos caracteres do começo do token estavam certos — um atacante pode recuperar o token um caractere de cada vez, medindo latência. A correção usa `crypto.timingSafeEqual` sobre o hash SHA-256 de ambos os lados, não sobre o valor cru.

**2. Um bypass de autenticação quase reintroduzido ao "reaproveitar" um helper antigo.** O repositório já teve um `tokensMatch()` (em um `scheduled-reports/crypto.ts` desde então removido) que parecia resolver o mesmo problema e seria a escolha óbvia para reutilizar aqui. Ele **decodificava** os dois lados como hex (`Buffer.from(value, "hex")`) antes de comparar — correto para o caso dele (digestos SHA-256 em hex), mas catastrófico para um bearer token arbitrário: `Buffer.from(...)` para silenciosamente no primeiro caractere não-hexadecimal, então `"Bearer <qualquer coisa>"` decodifica para o único byte `0xBE`. **Todo token que começasse com "Be" compararia como igual a qualquer outro.**

A lição sobrevive ao arquivo apagado: **uma comparação em tempo constante só é correta para a codificação para a qual foi escrita.** `timingSafeStringEqual` hasheia os dois lados para 32 bytes fixos antes de comparar — isso mantém `timingSafeEqual` (que lança exceção se os buffers tiverem tamanhos diferentes) seguro para entradas de qualquer tamanho, e evita que a própria comparação revele o comprimento do token esperado. O teste de regressão em `request-auth.test.ts` fixa exatamente essa colisão de "Be" para impedir que ela volte.

`isBearerTokenValid` retorna `false` sempre que o segredo esperado (`ADMIN_API_TOKEN`/`CRON_SECRET`) não está configurado — uma variável de ambiente não definida nunca pode deixar um endpoint aberto por omissão (fail-closed).

## Tokens de administração e cron

- **`ADMIN_API_TOKEN`**: autentica o CRUD de `report_schedules` do projeto padrão via `/api/schedules.ts`. É o mesmo valor cadastrado em Configurações no navegador — quem aponta o painel para o próprio Supabase gerencia agendamentos direto com a própria chave anon e não precisa deste token.
- **`CRON_SECRET`**: autentica os dois gatilhos periódicos (GitHub Actions e cron da Vercel) contra `/api/send-scheduled-reports.ts`. Precisa estar cadastrado tanto nas variáveis de ambiente da Vercel quanto como secret no GitHub (`Settings > Secrets and variables > Actions`).
- Nenhum dos dois **nunca** entra no bundle público — são lidos só em `frontend/api/*.ts`, que roda em Node no servidor, nunca no navegador.
- Ambos passam por `isBearerTokenValid`/`timingSafeStringEqual` (ver seção anterior). Não reintroduza uma comparação `===` ou um helper de decodificação hex genérico aqui.

## Tela de login

`frontend/src/components/states/login-state.tsx` só aparece quando uma consulta é recusada por permissão e ainda não há sessão — não é a porta de entrada do app (quem usa RLS aberta nunca a vê). Duas escolhas deliberadas:

- **Não existe link de "criar conta".** O cadastro público fica desabilitado no painel do Supabase; se estivesse aberto, exigir o papel `authenticated` não protegeria nada, já que qualquer pessoa criaria uma conta e voltaria a ler tudo. Contas são criadas por um administrador.
- **A mensagem de erro nunca distingue "e-mail não existe" de "senha errada"** — as duas mostram o mesmo texto genérico. Distinguir os dois casos entregaria, a quem tentasse, quais endereços têm conta cadastrada (enumeração de usuários).

Em caso de sucesso, o próprio componente não faz nada: `onAuthStateChange` em `SupabaseProvider` (`frontend/src/lib/supabase/context.tsx`) recebe a sessão, zera `authRequired`, e a árvore volta a renderizar o dashboard normalmente.

## Links de compartilhamento

Modelo de token (`frontend/src/lib/dashboard-shares/token.ts`):

- Token opaco de **256 bits**, gerado inteiramente no navegador com Web Crypto (`crypto.getRandomValues`).
- Só o **hash SHA-256** (hex) do token é salvo no banco (`dashboard_shares.token_hash`). O texto puro existe apenas na URL mostrada uma única vez a quem cria o link — não há como recuperá-lo depois.
- A função `get_shared_dashboard` (migration `20260802120000`) refaz o mesmo hash com `pgcrypto.digest()` do lado do servidor para comparar.
- **Regenerar** um link (`regenerateDashboardShareToken`) gera um hash novo para a mesma linha (mantendo nome/filtros/validade) e invalida o token antigo imediatamente — é a única forma de recuperação de "perdi o link", equivalente a um "esqueci minha senha".

**A URL do link carrega a URL e a chave anon do projeto Supabase de origem como query params.** Isso não é uma exposição nova: quem abre `/share/:token` não tem Configurações salvas nem sessão, então precisa saber a qual projeto se conectar antes de chamar `get_shared_dashboard`. A chave anon é feita para rodar no navegador — a segurança real está na RLS do banco e na validação do próprio token, não em esconder a chave anon (que já é o mesmo valor presente no bundle público do projeto padrão, ou no `localStorage` de quem configurou um projeto próprio).

Por padrão, a **lista de atividade recente fica desligada** num link novo (opt-in por link) porque ela expõe o e-mail do destinatário — o criador do link decide explicitamente se quer incluí-la.

## Log de auditoria e origem do ator

O ator de uma entrada de auditoria **nunca** vem de um valor enviado pelo cliente:

- No caminho direto-Supabase, a RPC `record_audit_event` resolve o ator a partir do JWT da própria sessão (`auth.uid()`/e-mail).
- No caminho servidor (cron, "forçar agora"), `recordAuditEventFromServer` identifica o ator como `"cron"` ou como o administrador que disparou a ação manual — nunca a partir de um campo arbitrário do corpo da requisição.

O metadado de uma ação sobre agendamento **nunca inclui a lista de destinatários** (`recipients`) — apenas a contagem (`recipientCount`). Isso é uma decisão de privacidade documentada na migration `20260814100000_audit_log.sql`, não uma omissão acidental.

Gravar uma entrada de auditoria é **non-fatal por design**: uma falha ao registrar (por exemplo, um projeto self-hosted que ainda não aplicou a migration do audit log) nunca pode transformar uma ação real bem-sucedida — criar um agendamento, enviar um relatório, revogar um link — em uma falha reportada ao usuário.

## Guarda contra open redirect (navigation safety)

`frontend/src/app/navigation-safety.test.ts` é uma defesa em profundidade contra a classe de bug coberta por **GHSA-wrjc-x8rr-h8h6** (open redirect via `<Link>`/`useNavigate`, react-router 6.0.0–7.17.0, já corrigida na versão instalada).

A CVE original só era explorável quando um valor controlado por terceiros definia o **início** do destino de navegação (ex.: `\\evil.com` ou `//evil.com` tratado como URL absoluta). Hoje toda navegação do app começa com um caminho literal (`/events/`, `/investigate?`, `/settings`), então nenhum trecho dinâmico ocupa a primeira posição e não pode trocar a origem — essa propriedade vale independentemente da versão do router instalada, e é por isso que o teste é uma **guarda permanente**, não uma mitigação temporária para remover depois de atualizar uma dependência.

O teste varre todo `.ts`/`.tsx` do projeto em busca de destinos de navegação dinâmicos e falha para qualquer um que não comece com um literal, forçando revisão consciente. Exceções verificadas manualmente ficam em `ALLOWED_DYNAMIC_TARGETS`, cada uma com a justificativa de por que os ramos possíveis sempre começam com um literal. Remova uma exceção da lista assim que o símbolo que ela cobria deixar de existir — uma entrada obsoleta vira um passe livre para qualquer código novo que reusar o mesmo nome de variável.

## Segredos e variáveis de ambiente

- O frontend (bundle enviado ao navegador) só usa `VITE_SUPABASE_URL` e a chave anon/publishable — nunca uma chave de service role.
- `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_APP_PASSWORD`, `CRON_SECRET` e `ADMIN_API_TOKEN` só existem em variáveis de ambiente do lado do servidor (Vercel Project Settings / GitHub Actions secrets), lidas exclusivamente por código sob `frontend/api/`.
- `vite.config.ts` evita importar `package.json` no código de produção para não vazar a lista completa de dependências (incluindo as de desenvolvimento) no bundle público.
- Cabeçalhos de segurança HTTP (proteção contra clickjacking, controle de referenciador, HSTS, Permissions-Policy) e uma Content-Security-Policy são aplicados no deploy (`vercel.json`). A CSP rodou em modo `Report-Only` por um tempo antes de ser efetivamente aplicada, para confirmar que não bloquearia nada em produção antes de virar bloqueio de verdade.
