# Seslock Holmes

Seslock Holmes é um dashboard web de investigação de e-mails do AWS SES armazenados no Supabase/PostgreSQL.
Ele foi feito para apoiar suporte, operações e análise na leitura de eventos, rastreamento de mensagens e diagnóstico de falhas — com relatórios agendados por e-mail e compartilhamento público somente-leitura de visões do dashboard.

## 📉 Resultados reais

Graças ao Seslock Holmes, é possível investigar e corrigir problemas de entregabilidade em produção. Os números falam por si:

| Métricas | Antes | Depois | Redução |
|---|---|---|---|
| Bounce rate (1 provedor) | 11,6% | 0,8% | **-93%** |
| Bounce rate geral | 6,8% | 1,8% | **-74%** |

Cada bounce diagnosticado virou uma correção concreta:
- 📧 Endereços inválidos removidos da base
- 🌐 Domínios sem registro MX corrigidos
- 🔐 Falhas de autenticação DMARC ajustadas

O resultado indireto é tão importante quanto o número: **reputação de envio melhorada**, menos mensagens caindo em spam, e menor risco de provedores bloquearem o envio por conta da reputação baixa.


## Demo

O projeto está disponível através da Vercel:

🔗 **https://seslock-holmes.vercel.app/**

> A aplicação é hospedada na Vercel e pode ser utilizada para validar a interface, navegação e integração com um projeto Supabase configurado.

## Visão Geral

A leitura dos eventos de e-mail é somente leitura:

- não cria, edita nem remove eventos de e-mail;
- consultas de eventos dependem de RLS/autenticação no Supabase.

Além da leitura, o projeto também escreve em duas áreas próprias, protegidas por RLS separada da tabela de eventos:

- **relatórios agendados**, que disparam e-mails periódicos por conta própria;
- **links de compartilhamento**, que geram acesso público somente-leitura a uma visão do dashboard.

## Principais Funcionalidades

- Visão geral com atividade recente, eventos problemáticos e principais origens, com indicadores calculados no próprio banco (via RPC) para refletir o período inteiro filtrado, não apenas uma amostra.
- Painel de analytics com distribuição de eventos, reputação, taxa de bounce (com filtro por subtipo: suppressed, general, mailbox full, content rejected, undetermined), tempo médio de entrega, último evento recebido, principais provedores, principais motivos de bounce e aplicações/origens.
- Investigação por destinatário, remetente, provedor (domínio do destinatário) ou diagnóstico de bounce.
- Busca global no cabeçalho, disponível em qualquer página, com persistência de texto/modo/filtros entre navegações.
- Detalhes completos do evento com assunto, remetente, destinatário, status e metadados de falha.
- Rastreamento cronológico da mensagem, com os dados mais relevantes de cada evento (origem/IP, tempo de processamento, resposta SMTP, tipo/subtipo de bounce, diagnostic code, feedback de reclamação) exibidos diretamente no card.
- Exportação de relatório em CSV/PDF e por e-mail sob demanda.
- **Relatórios agendados**: criação de agendamentos recorrentes (diário/semanal/etc.) com filtros próprios, múltiplos destinatários, histórico de execuções, pausa/retomada, exclusão e disparo manual ("forçar agora"). O disparo periódico roda por um workflow do GitHub Actions a cada 15 minutos, com o cron da Vercel como reforço diário.
- **Compartilhamento de dashboard**: botão "Compartilhar" na Visão geral gera um link público somente-leitura com os filtros atuais travados, protegido por token de 256 bits, sem exigir conta de quem acessa. A lista de atividade recente é opcional por link. Links criados podem ser listados e revogados em Configurações.
- Login por e-mail e senha, exibido sob demanda apenas quando uma consulta é recusada por falta de permissão (contas são criadas por um administrador, sem cadastro aberto).
- Paginação no banco na atividade recente e na investigação por busca.
- Sugestões de e-mails semelhantes quando não há correspondência exata.
- Tema claro/escuro.
- Página de FAQ pesquisável para dúvidas operacionais e de uso.
- Página de configurações para ajustar idioma, fuso horário, relógio, intervalo de atualização, conexão com Supabase e token de administração dos relatórios agendados.

## Rotas

- `/` - visão geral
- `/investigate` - investigação por busca
- `/events/:eventId` - detalhes do evento
- `/scheduled-reports` - relatórios agendados
- `/faq` - perguntas frequentes e ajuda
- `/settings` - configurações do app e do Supabase
- `/share/:token` - visão pública somente-leitura de um dashboard compartilhado (fora do shell autenticado)

## Estrutura do Projeto

```text
seslock-holmes/
├── frontend/
│   ├── api/                       # funções serverless (Vercel) dos relatórios agendados
│   │   ├── schedules.ts           # CRUD de agendamentos via ADMIN_API_TOKEN
│   │   ├── run-schedule-now.ts    # disparo manual de um agendamento
│   │   └── send-scheduled-reports.ts # varredura e envio periódico (cron)
│   ├── public/                    # robots.txt, theme-init.js, favicon
│   └── src/
│       ├── app/                   # shell, rotas e providers
│       ├── assets/                # imagens e favicon
│       ├── components/
│       │   ├── shell/             # header, footer e frame da aplicação
│       │   ├── states/            # loading, empty, error e setup
│       │   └── ui/                # componentes visuais base
│       ├── features/
│       │   ├── dashboard-share/   # geração e gestão de links públicos somente-leitura
│       │   ├── event-detail/      # detalhes do evento
│       │   ├── faq/               # ajuda e perguntas frequentes
│       │   ├── message-trace/     # timeline da mensagem
│       │   ├── overview/          # dashboard principal, analytics e exportação
│       │   ├── recipient-search/  # busca e investigação por e-mail
│       │   ├── scheduled-reports/ # criação, histórico e gestão de relatórios agendados
│       │   └── settings/          # preferências e configuração do Supabase
│       ├── lib/
│       │   ├── dashboard-shares/  # token, link e queries dos links compartilhados
│       │   ├── data/              # listas e opções de filtro
│       │   ├── filters/           # normalização e aplicação de filtros
│       │   ├── formatters/        # formatação de datas, e-mails e eventos
│       │   ├── hooks/             # hooks reutilizáveis
│       │   ├── i18n/              # textos e traduções
│       │   ├── overview/          # analytics e métricas
│       │   ├── recipient-search/  # lógica de busca e sugestões
│       │   ├── scheduled-reports/ # tipos, queries e frequência dos agendamentos
│       │   ├── server/            # autenticação de requests das funções serverless
│       │   ├── supabase/          # client, queries, tipos e settings
│       │   └── time-filters.ts    # utilitários de período
│       ├── styles/                # estilos globais
│       └── main.tsx
├── supabase/
│   └── migrations/                # migrations SQL (RLS, RPCs de analytics, schedules, shares)
├── .github/workflows/             # disparo periódico dos relatórios agendados (GitHub Actions)
├── specs/                         # documentação da feature
└── README.md
```

## Fluxo de Uso

### 1. Visão Geral

Na página inicial você pode:

- pesquisar um destinatário rapidamente;
- filtrar por janela de tempo;
- filtrar por status;
- filtrar por origem;
- filtrar por provedor;
- ordenar a atividade recente;
- navegar pelas páginas da atividade recente.

### 2. Investigação

Na tela de investigação você pode escolher o modo de busca:

- destinatário;
- remetente;
- origem.

Se a busca exata não retornar resultado, o sistema mostra sugestões de e-mails semelhantes.

### 3. Detalhes do Evento

Ao abrir um evento, o sistema exibe:

- assunto do e-mail;
- ID do evento;
- ID da mensagem;
- status de entrega;
- origem da mensagem;
- identidade SMTP;
- e-mail do remetente;
- destinatário;
- detalhes de falha e entrega;
- rastreamento da mensagem.

### 4. FAQ

A página de FAQ ajuda a responder dúvidas operacionais e de uso do painel.

Você pode:

- pesquisar perguntas e respostas;
- navegar por categorias de ajuda;
- encontrar informações sobre dados, uso e suporte sem sair do app.

### 5. Relatórios Agendados

Na tela de relatórios agendados você pode:

- criar um agendamento com nome, frequência, filtros (janela, status, subtipo de bounce, origem, provedor, assunto) e lista de destinatários;
- editar, pausar/retomar ou excluir um agendamento existente;
- ver o histórico de execuções de um agendamento;
- forçar o disparo imediato de um agendamento ("forçar agora"), fora do horário programado.

O e-mail enviado inclui uma seção "O que fazer com este relatório" quando o filtro cobre eventos de problema, com explicações em linguagem simples e destaque para destinatários com falha recorrente.

### 6. Compartilhamento de Dashboard

Na Visão geral, o botão "Compartilhar" permite:

- gerar um link público que trava os filtros atuais (janela, status, origem, provedor, etc.);
- decidir se a lista de atividade recente entra no link (desligada por padrão, pois expõe e-mail de destinatário);
- definir uma validade para o link (ou nenhuma).

Quem abre `/share/:token` vê uma versão somente-leitura do dashboard, sem precisar de conta. Os links criados ficam listados em Configurações, onde também podem ser revogados a qualquer momento.

### 7. Configurações

A tela de configurações permite ajustar:

- idioma da interface;
- fuso horário;
- formato do relógio;
- intervalo de atualização;
- URL do Supabase;
- chave pública/publishable do Supabase;
- nome da tabela ou view de eventos;
- token de administração usado para gerenciar os relatórios agendados do projeto padrão;
- lista e revogação dos links de compartilhamento de dashboard já criados.

As configurações podem ser:

- salvas apenas no navegador;
- exportadas como arquivo `.env.local`;
- gravadas diretamente no projeto local quando o navegador oferecer acesso ao sistema de arquivos.

## Supabase

O app usa o Supabase como fonte de dados. Por padrão, a tabela esperada é `aws_sns`.

Se a tabela padrão não existir, o painel permite informar o nome correto da tabela ou view de eventos.
Esse valor fica salvo localmente no navegador para evitar nova configuração toda vez.

As credenciais usadas no frontend são apenas a URL e a chave pública/publishable, nunca uma chave de serviço.

### Variáveis de Ambiente

O frontend aceita as seguintes variáveis:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_SUPABASE_EVENTS_TABLE=aws_sns
```

Compatibilidade adicional:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
NEXT_PUBLIC_SUPABASE_EVENTS_TABLE=aws_sns
```

Notas:

- `VITE_SUPABASE_ANON_KEY` tem prioridade quando disponível.
- `VITE_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` também são aceitas.
- Se `VITE_SUPABASE_EVENTS_TABLE` não for definido, o app tenta `aws_sns`.
- As configurações podem ser preenchidas pela página de settings e ficam armazenadas localmente no navegador.

### Relatórios Agendados (backend)

O envio de relatórios agendados roda em funções serverless (`frontend/api/`), não no navegador, e precisa de variáveis de ambiente próprias configuradas no provedor de deploy (ex.: Vercel Project Settings):

```bash
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role   # nunca exposta ao frontend
GMAIL_USER=conta@gmail.com                          # remetente dos e-mails de relatório
GMAIL_APP_PASSWORD=sua_senha_de_app_do_gmail
CRON_SECRET=um_segredo_forte                        # autentica os disparos periódicos
ADMIN_API_TOKEN=um_segredo_forte                    # autentica o CRUD de agendamentos no projeto padrão
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` é obrigatória porque o envio roda fora de uma sessão de usuário; nunca deve ser usada no frontend.
- `CRON_SECRET` também precisa ser cadastrado como secret no GitHub (`Settings > Secrets and variables > Actions`) para o workflow `.github/workflows/scheduled-reports-trigger.yml`, que dispara o envio a cada 15 minutos (o cron da Vercel, uma vez por dia, fica só como reforço).
- `ADMIN_API_TOKEN` é o mesmo valor informado em Configurações no navegador para gerenciar agendamentos do projeto padrão; quem aponta o painel para o próprio Supabase gerencia agendamentos diretamente com a própria chave anon, sem precisar desse token.
- Sem essas variáveis, as páginas de leitura do dashboard continuam funcionando normalmente — apenas os relatórios agendados ficam indisponíveis.

## Estrutura de Dados Esperada

O painel trabalha com uma tabela ou view que contenha, no mínimo, campos equivalentes a:

- `id`
- `timestamp` ou `created_at`
- `messageId`
- `eventType` ou `notificationType`
- `subject`
- `source`
- `sourceArn`
- `snsTopicArn`
- `destination`
- `bounceType`
- `bounceSubType`
- `bouncedRecipients`
- `diagnosticCode`
- `remoteMtaIp`
- `reportingMta`
- `smtpResponse`
- `complaintFeedbackType`
- `complainedRecipients`
- `userAgent`

O aplicativo mapeia esses campos para uma visão unificada de evento de e-mail.

## Regras de Leitura

- O app só faz consultas de leitura sobre a tabela de eventos do SES.
- Consultas aos eventos e aos agendamentos exigem sessão autenticada no Supabase (RLS nega acesso anônimo); o login aparece automaticamente quando uma consulta é recusada por falta de permissão.
- Indicadores do overview (distribuição, reputação, taxa de bounce, tempo médio de entrega, etc.) são calculados no banco via RPC, cobrindo o período filtrado inteiro em vez de uma amostra baixada no navegador.
- A lógica respeita filtros por janela de tempo, status, subtipo de bounce e origem.
- O overview também pode ser refinado por provedor e ordenação da atividade recente.
- A busca por destinatário e remetente usa normalização de texto para reduzir variações de caixa.
- O rastreamento da mensagem usa `messageId` quando disponível.

## Desenvolvimento Local

### Pré-requisitos

- Node.js 18+.
- Um projeto Supabase com dados de eventos de e-mail disponíveis.

### Instalação

```bash
cd frontend
npm install
```

### Execução

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite no navegador.

### Com Docker

Também é possível rodar o frontend em um container, útil para testar em outra máquina:

```bash
cd frontend
docker compose up
```

Isso sobe o servidor de desenvolvimento do Vite em `http://localhost:5173`.

## Deploy

O frontend é compatível com a Vercel.

Deploy em produção:

- **Produção:** https://seslock-holmes.vercel.app/

Para publicar sua própria instância:

1. Faça um fork ou clone do repositório.
2. Aplique as migrations em `supabase/migrations/` no seu projeto Supabase (RLS dos eventos, RPCs de analytics, tabelas de relatórios agendados e de links compartilhados).
3. Importe o projeto na Vercel.
4. Configure as variáveis de ambiente do frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e, opcionalmente, `VITE_SUPABASE_EVENTS_TABLE`).
5. Se for usar relatórios agendados, configure também as variáveis de backend (`SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`, `ADMIN_API_TOKEN` — veja [Relatórios Agendados (backend)](#relatórios-agendados-backend)) e cadastre `CRON_SECRET` como secret no GitHub para o workflow em `.github/workflows/`.
6. Realize o deploy.

## Scripts

Dentro de `frontend/`:

- `npm run dev` - inicia o servidor de desenvolvimento
- `npm run build` - gera a build de produção
- `npm run preview` - visualiza a build localmente
- `npm run test` - executa testes com Vitest
- `npm run typecheck` - valida os tipos TypeScript

## Configuração Recomendada do Supabase

Para obter a melhor experiência:

- crie uma política RLS que permita `SELECT` na tabela de eventos apenas para usuários autenticados esperados (sem acesso anônimo);
- crie as contas de acesso pelo painel do Supabase — não há cadastro aberto pela aplicação;
- garanta que a tabela ou view exponha os dados necessários para investigação;
- aplique as migrations de `supabase/migrations/` que criam as RPCs de analytics e as tabelas de relatórios agendados (`report_schedules`) e links compartilhados (`dashboard_shares`), cada uma com sua própria política de RLS;
- mantenha índices nos campos usados com frequência, como:
  - `timestamp`
  - `messageId`
  - `eventType`
  - `source`
  - destinatário ou colunas equivalentes

## Segurança

- O frontend nunca usa a chave de service role do Supabase — apenas URL e chave anon/publishable.
- A chave de service role só é usada no backend (`frontend/api/`), fora do navegador, para o envio de relatórios agendados.
- O deploy inclui cabeçalhos de segurança HTTP (proteção contra clickjacking, controle de referenciador, HSTS, Permissions-Policy) e uma Content-Security-Policy em modo de observação.
- Links de compartilhamento usam token de 256 bits e não expõem nada além do que o criador do link escolheu incluir.
- O painel não é indexado por buscadores (`robots.txt` e meta tag `noindex`).
- Consulte o [CHANGELOG](frontend/CHANGELOG.md) para o histórico de correções de segurança já aplicadas.

## Troubleshooting

### O painel fica preso em "Conectando ao Supabase"

Verifique:

- se `VITE_SUPABASE_URL` está definida;
- se a chave pública está correta;
- se o navegador consegue acessar o projeto Supabase;
- se a tabela configurada existe;
- se a política RLS permite `SELECT`.

### A tabela não é encontrada

Se o nome real da tabela ou view for diferente de `aws_sns`, informe o nome correto na tela de configuração ou em `VITE_SUPABASE_EVENTS_TABLE`.

### A página mostra poucos resultados

O painel pagina a atividade recente e a investigação. Use os botões de próxima/anterior para navegar pelos resultados filtrados.

### A tela de login aparece mesmo com URL e chave configuradas

Isso é esperado quando a política de RLS exige um usuário autenticado: a chave anon sozinha não é mais suficiente para ler os eventos. Faça login com uma conta criada pelo administrador do projeto Supabase.

### A aba de relatórios agendados pede um token de administração

Isso acontece quando o painel está apontando para o projeto Supabase padrão (não um projeto próprio configurado em Configurações). Informe o `ADMIN_API_TOKEN` cadastrado no backend na tela de Configurações. Quem conecta o próprio projeto Supabase gerencia agendamentos direto com a própria chave anon, sem precisar desse token.

## FAQ Rápido

- O app grava credenciais no GitHub? Não. As configurações ficam no navegador ou em `.env.local` local, e o arquivo é ignorado pelo Git.
- O frontend usa chave secreta do Supabase? Não. Ele usa apenas URL e chave pública/publishable; a chave de service role só existe no backend dos relatórios agendados.
- A página inicial precisa virar `/dashboard`? Não necessariamente. `/` já é a rota mais limpa para a home do produto.
- Quem abre um link de compartilhamento vê tudo do dashboard? Não. Só vê a visão com os filtros travados pelo criador do link, e a atividade recente só aparece se o criador tiver escolhido incluí-la.

## Documentação da Feature

A pasta `specs/001-ses-investigation/` contém os artefatos de especificação e planejamento do painel:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `tasks.md`

## Contribuição

Se você for contribuir, siga o fluxo padrão:

1. Crie uma branch.
2. Faça as alterações.
3. Rode os testes relevantes.
4. Abra um PR com uma descrição objetiva do que mudou.

## Licença

Este projeto está licenciado sob a [Licença MIT](LICENSE).
