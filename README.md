# Seslock Holmes

Seslock Holmes é um painel web de investigação para eventos de email do AWS SES armazenados no Supabase/PostgreSQL.
O foco é apoiar times de suporte, operação e análise na leitura de eventos, rastreamento de mensagens e diagnóstico de falhas.

<p align="center">
  <img src="https://github.com/user-attachments/assets/f4f44189-6190-4477-adaa-a13e790995e0" width="900" alt="Dashboard">
</p>

<details>
<summary><strong>📸 Ver mais screenshots</strong></summary>

<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/22e5dd9f-82e0-4aad-ae3c-e88ddfb42242" width="800"><br><br>
  <img src="https://github.com/user-attachments/assets/37812d9a-8e63-42fc-afe8-abfdc7ef11c8" width="800"><br><br>
  <img src="https://github.com/user-attachments/assets/e0ea06bd-e915-4e1c-8ff8-0a775a0dc9ac" width="800"><br><br>
  <img src="https://github.com/user-attachments/assets/7aa2445e-c5b9-4401-a4b6-44028839a2a8" width="800">
</p>

</details>

O projeto é somente leitura:

- não cria, edita nem remove eventos;
- não exige credenciais de escrita;
- depende de RLS no Supabase para permitir apenas consultas seguras.

## O que o sistema faz

- Mostra uma visão geral com atividade recente, eventos problemáticos e principais origens.
- Permite investigar por destinatário, remetente ou origem.
- Mostra detalhes de cada evento, incluindo assunto, remetente, destinatário, status e metadados de falha.
- Exibe rastreamento cronológico da mensagem para entender o ciclo completo.
- Oferece paginação na atividade recente e também na investigação por pesquisa.
- Quando não há correspondência exata, sugere emails parecidos para facilitar a análise.

## Tecnologias

- React 18
- Vite
- TypeScript
- React Router
- TanStack Query
- Supabase JS
- `@supabase/ssr`
- Tailwind CSS
- componentes próprios inspirados em shadcn/ui
- Vitest
- React Testing Library
- Playwright

## Estrutura principal

```text
Dashboard/
├── frontend/
│   ├── src/
│   │   ├── app/                  # shell do app, rotas e providers
│   │   ├── components/          # componentes compartilhados
│   │   ├── features/            # telas por funcionalidade
│   │   ├── lib/                 # utilitários, Supabase, formatadores
│   │   └── styles/              # estilos globais
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig*.json
├── specs/                       # documentação e especificação do recurso
└── README.md
```

## Rotas da aplicação

- `/` - visão geral
- `/investigate` - investigação por busca
- `/events/:eventId` - detalhes do evento

## Fluxo de uso

### 1. Visão geral

Na página inicial você pode:

- pesquisar um destinatário rapidamente;
- filtrar por janela de tempo;
- filtrar por status;
- filtrar por origem;
- navegar pelas páginas da atividade recente.

### 2. Investigação

Na tela de investigação você pode escolher o modo de busca:

- procurar destinatário;
- procurar remetente;
- procurar origem.

Se a busca exata não retornar resultado, o sistema mostra sugestões de emails semelhantes.

### 3. Detalhes do evento

Ao abrir um evento, o sistema exibe:

- assunto do email;
- ID do evento;
- ID da mensagem;
- status de entrega;
- origem da mensagem;
- identidade SMTP;
- email do remetente;
- destinatário;
- detalhes de falha e entrega;
- rastreamento da mensagem.

## Supabase

O app usa o Supabase como fonte de dados. Por padrão, a tabela esperada é `aws_sns`.

Se a tabela padrão não existir, o painel permite informar o nome correto da tabela ou view de eventos.
Esse valor fica salvo localmente no navegador para evitar nova configuração toda vez.

### Variáveis de ambiente

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

## Estrutura de dados esperada

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

O aplicativo mapeia esses campos para uma visão unificada de evento de email.

## Regras de leitura

- O app só faz consultas de leitura.
- A lógica respeita filtros por janela de tempo, status e origem.
- A busca por destinatário e remetente usa normalização de texto para reduzir variações de caixa.
- O rastreamento da mensagem usa `messageId` quando disponível.

## Desenvolvimento local

Entre na pasta do frontend e instale as dependências:

```bash
cd frontend
npm install
```

Execute o servidor de desenvolvimento:

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite no navegador.

## Scripts disponíveis

Dentro de `frontend/`:

- `npm run dev` - inicia o servidor de desenvolvimento
- `npm run build` - gera a build de produção
- `npm run preview` - visualiza a build localmente
- `npm run test` - executa testes com Vitest
- `npm run test:e2e` - executa testes end-to-end com Playwright
- `npm run typecheck` - valida os tipos TypeScript

## Configuração recomendada do Supabase

Para obter a melhor experiência:

- crie uma política RLS que permita `SELECT` apenas para os usuários esperados;
- garanta que a tabela ou view exponha os dados necessários para investigação;
- mantenha índices nos campos usados com frequência, como:
  - `timestamp`
  - `messageId`
  - `eventType`
  - `source`
  - destinatário ou colunas equivalentes

## Convenções do projeto

- A interface está em português brasileiro.
- Termos técnicos do domínio podem permanecer em inglês quando isso ajuda a identificação operacional, como `bounce`, `complaint`, `SMTP`, `SES` e `messageId`.
- O projeto é organizado por funcionalidade, e não por tipo de arquivo.
- O app é projetado para leitura rápida e investigação operacional.

## Problemas comuns

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

## Documentação do recurso

A pasta `specs/001-ses-investigation/` contém os artefatos de especificação e planejamento do painel:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `tasks.md`

## Licença

Este repositório não inclui uma licença explícita. Se necessário, adicione uma antes de distribuir o projeto.
