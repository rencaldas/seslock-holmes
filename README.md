# Seslock Holmes

Seslock Holmes é um dashboard web de investigação de e-mails do AWS SES armazenados no Supabase/PostgreSQL.
Ele foi feito para apoiar suporte, operações e análise na leitura de eventos, rastreamento de mensagens e diagnóstico de falhas.

## Visão Geral

O projeto é somente leitura:

- não cria, edita nem remove eventos;
- não exige credenciais de escrita;
- depende de RLS no Supabase para limitar consultas aos dados permitidos.

## Principais Funcionalidades

- Visão geral com atividade recente, eventos problemáticos e principais origens.
- Painel de analytics com distribuição de eventos, reputação, taxa de bounce, tempo médio de entrega, último evento recebido, principais provedores, principais motivos de bounce e aplicações/origens.
- Investigação por destinatário, remetente, bounceType ou origem.
- Detalhes completos do evento com assunto, remetente, destinatário, status e metadados de falha.
- Rastreamento cronológico da mensagem para entender o ciclo completo.
- Paginação na atividade recente e na investigação por busca.
- Sugestões de e-mails semelhantes quando não há correspondência exata.
- Página de FAQ pesquisável para dúvidas operacionais e de uso.
- Página de configurações para ajustar idioma, fuso horário, relógio, intervalo de atualização e conexão com Supabase.

## Rotas

- `/` - visão geral
- `/investigate` - investigação por busca
- `/events/:eventId` - detalhes do evento
- `/faq` - perguntas frequentes e ajuda
- `/settings` - configurações do app e do Supabase

## Estrutura do Projeto

```text
Dashboard/
├── frontend/
│   └── src/
│       ├── app/                  # shell, rotas e providers
│       ├── assets/               # imagens e favicon
│       ├── components/
│       │   ├── shell/            # header, footer e frame da aplicação
│       │   ├── states/           # loading, empty, error e setup
│       │   └── ui/               # componentes visuais base
│       ├── features/
│       │   ├── event-detail/     # detalhes do evento
│       │   ├── faq/              # ajuda e perguntas frequentes
│       │   ├── message-trace/    # timeline da mensagem
│       │   ├── overview/         # dashboard principal e analytics
│       │   ├── recipient-search/ # busca e investigação por e-mail
│       │   └── settings/         # preferências e configuração do Supabase
│       ├── lib/
│       │   ├── data/             # listas e opções de filtro
│       │   ├── formatters/       # formatação de datas, e-mails e eventos
│       │   ├── hooks/            # hooks reutilizáveis
│       │   ├── i18n/             # textos e traduções
│       │   ├── overview/         # analytics e métricas
│       │   ├── supabase/         # client, queries, tipos e settings
│       │   └── time-filters.ts   # utilitários de período
│       ├── styles/               # estilos globais
│       └── main.tsx
├── specs/                        # documentação da feature
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

### 5. Configurações

A tela de configurações permite ajustar:

- idioma da interface;
- fuso horário;
- formato do relógio;
- intervalo de atualização;
- URL do Supabase;
- chave pública/publishable do Supabase;
- nome da tabela ou view de eventos.

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

- O app só faz consultas de leitura.
- A lógica respeita filtros por janela de tempo, status e origem.
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

## Scripts

Dentro de `frontend/`:

- `npm run dev` - inicia o servidor de desenvolvimento
- `npm run build` - gera a build de produção
- `npm run preview` - visualiza a build localmente
- `npm run test` - executa testes com Vitest
- `npm run test:e2e` - executa testes end-to-end com Playwright
- `npm run typecheck` - valida os tipos TypeScript

## Configuração Recomendada do Supabase

Para obter a melhor experiência:

- crie uma política RLS que permita `SELECT` apenas para os usuários esperados;
- garanta que a tabela ou view exponha os dados necessários para investigação;
- mantenha índices nos campos usados com frequência, como:
  - `timestamp`
  - `messageId`
  - `eventType`
  - `source`
  - destinatário ou colunas equivalentes

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

## FAQ Rápido

- O app grava credenciais no GitHub? Não. As configurações ficam no navegador ou em `.env.local` local, e o arquivo é ignorado pelo Git.
- O frontend usa chave secreta do Supabase? Não. Ele usa apenas URL e chave pública/publishable.
- A página inicial precisa virar `/dashboard`? Não necessariamente. `/` já é a rota mais limpa para a home do produto.

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

Este repositório não inclui uma licença explícita.
