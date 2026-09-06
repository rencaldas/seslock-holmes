# Documentação Técnica — Leia Antes de Mexer

Esta pasta documenta decisões de código que não são óbvias só de ler os arquivos — incidentes de segurança já corrigidos, pegadinhas de infraestrutura (Vercel, PostgREST, Gmail), e por que certas partes do sistema funcionam do jeito que funcionam. Ela existe para não depender de comentários longos espalhados pelo código: o comentário que sobra na função é uma frase curta apontando para cá.

> Isto é diferente da [Dashboard Constitution](../.specify/memory/constitution.md) do speckit (`.specify/memory/constitution.md`), que define princípios de processo para specs/plans/tasks (ex.: "PostgreSQL é fonte de verdade", "least-privilege access"). Aqui documentamos **como o código já implementado funciona de fato**, não regras de processo para features futuras.

## Antes de tocar nestas áreas, leia a seção correspondente

| Se você vai mexer em... | Leia primeiro |
|---|---|
| Login, RLS, `isPermissionDeniedError` | [SECURITY.md § RLS não gera erro em SELECT](./SECURITY.md#rls-não-gera-erro-em-select--a-pegadinha-do-grant) |
| `ADMIN_API_TOKEN` / `CRON_SECRET` / comparação de tokens | [SECURITY.md § Incidente: comparação de tokens](./SECURITY.md#incidente-comparação-de-tokens-em-tempo-constante) |
| RBAC (viewer/manager), `useUserRole` | [ARCHITECTURE.md § RBAC leve](./ARCHITECTURE.md#rbac-leve-viewer-e-manager) |
| Links de compartilhamento / regeneração de token | [SECURITY.md § Links de compartilhamento](./SECURITY.md#links-de-compartilhamento) |
| Log de auditoria | [SECURITY.md § Log de auditoria e origem do ator](./SECURITY.md#log-de-auditoria-e-origem-do-ator) |
| Overview / RPCs de analytics / seletor de linhas | [ARCHITECTURE.md § Overview](./ARCHITECTURE.md#overview-agregação-no-banco-via-rpc) |
| Relatórios agendados / cron / e-mail | [ARCHITECTURE.md § Relatórios agendados](./ARCHITECTURE.md#relatórios-agendados) |
| Qualquer import relativo com `.js` em `frontend/api/` | [ARCHITECTURE.md § Convenções de infraestrutura](./ARCHITECTURE.md#convenções-de-infraestrutura-vercel) |
| Navegação (`<Link>`, `useNavigate`, destinos dinâmicos) | [SECURITY.md § Guarda contra open redirect](./SECURITY.md#guarda-contra-open-redirect-navigation-safety) |

## Índice

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — como o sistema funciona: fluxo de dados, RPCs de analytics, RBAC, relatórios agendados, compartilhamento, log de auditoria, convenções da Vercel, referência de códigos de erro do PostgREST.
- **[SECURITY.md](./SECURITY.md)** — modelo de segurança: RLS, dois incidentes reais já corrigidos (GRANT/RLS e timing attack), tokens de administração, tela de login, tokens de compartilhamento, guarda contra open redirect.

## Convenção para comentários no código

Ao encontrar um comentário longo (mais de ~4 linhas) explicando uma decisão, prefira:

1. Mover a explicação completa para a seção apropriada aqui (criando uma nova se não existir uma boa).
2. Deixar no código só o essencial para não cometer o erro na hora de editar a linha — normalmente 1 a 3 linhas — com um ponteiro `// ver docs/ARCHITECTURE.md#secao` ou `// ver docs/SECURITY.md#secao`.

Comentários curtos e locais (uma invariante de uma função, um código de erro decodificado, um "isto é intencional" ao lado de um catch vazio) continuam no código — não precisam de um documento à parte.
