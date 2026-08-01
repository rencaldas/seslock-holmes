# Changelog

All notable changes to this project will be documented in this file.

## [1.9.0] - 2026-08-01
### Changed
- Os números do painel passaram a ser calculados no próprio banco, e não mais no navegador. Antes o painel baixava até 20.000 eventos para somar tudo por conta própria, o que além de lento deixava os indicadores errados quando o período tinha mais eventos que isso: com 99 mil eventos em 30 dias, a taxa de bounce exibida era a dos 8 dias mais recentes (2,53%), não a do mês (3,01%). Agora os cartões refletem sempre o período inteiro escolhido — e trocar a janela de 30 para 90 dias volta a fazer diferença.
- A lista de atividade recente também passou a paginar no banco, incluindo os filtros de origem, assunto e provedor. Exibir 50 linhas custava baixar até 20.000; agora só trafegam as linhas da página.
- O seletor de linhas foi renomeado para "Linhas no relatório" e passa a valer apenas para o CSV/PDF. Ele existia como válvula de performance do navegador, e esse motivo deixou de existir — mantê-lo sobre os indicadores fazia os cartões mostrarem a taxa de uma amostra de poucos minutos como se fosse a do período inteiro.
- O relatório CSV/PDF só busca os dados quando você clica para gerá-lo. Antes essa busca acontecia em todo carregamento da página, mesmo para quem nunca exportava nada.
- O aviso de "resultado incompleto" saiu do painel: a condição que ele sinalizava deixou de existir, já que os indicadores agora cobrem todo o período. Ele continua valendo para o relatório, que é o único lugar que ainda tem teto de linhas.

## [1.8.1] - 2026-08-01
### Fixed
- Fechado o acesso anônimo aos eventos do SES e aos agendamentos. A política que liberava a leitura para visitantes sem conta continuava ativa ao lado da nova, e no PostgreSQL essas regras se somam em vez de se substituírem — na prática, o painel seguia aberto para qualquer pessoa com o endereço. O acesso anônimo de escrita aos agendamentos era ainda mais sério: permitia cadastrar um relatório apontando para um endereço qualquer e receber os dados por e-mail, contornando a proteção dos eventos por outro caminho.
- A tela de login agora aparece de fato quando falta permissão. Antes, uma consulta sem acesso não devolvia erro — devolvia uma lista vazia, indistinguível de "não há eventos no período" —, então o painel ficava vazio sem oferecer nenhum caminho para entrar.

## [1.8.0] - 2026-07-31
### Added
- Login por e-mail e senha, exibido sob demanda: a tela só aparece quando uma consulta é recusada por falta de permissão. Quem aponta o painel para um Supabase próprio com a leitura liberada continua entrando direto, sem precisar de conta. Não há cadastro aberto — as contas são criadas por um administrador.
- Botão de sair no topo, visível apenas quando existe uma sessão ativa.
### Changed
- A sessão do Supabase passa a ser guardada no navegador e renovada automaticamente. Antes o cliente era criado sem sessão nenhuma, o que fazia sentido enquanto o painel não tinha login — mas sem a renovação automática uma investigação longa seria interrompida quando o token expirasse.
- Consultas recusadas por falta de permissão não são mais repetidas automaticamente: a resposta não muda sem uma sessão, e a repetição só atrasava a exibição da tela de login.

## [1.7.0] - 2026-07-31
### Added
- Cabeçalhos de segurança HTTP no deploy (proteção contra clickjacking, controle de referenciador, HSTS e Permissions-Policy), além de uma Content-Security-Policy em modo de observação, que por enquanto apenas reporta violações sem bloquear nada.
- Aviso visível quando uma busca atinge o teto de eventos: tanto o painel quanto os relatórios agendados agora informam que o resultado está incompleto. Numa ferramenta de investigação, um resultado cortado em silêncio pode levar alguém a concluir que não existem mais bounces para um destinatário quando existem.
### Changed
- A opção "sem limite" do seletor de linhas passou a ter um teto de 20.000 eventos. Antes ela percorria a tabela inteira, o que trava a aba do navegador conforme a base de eventos do SES cresce.
- A "Entrega automática para o seu Supabase" (introduzida na 1.3.0) foi removida, junto com a aba correspondente na página de Relatórios agendados. Quem quiser entrega automática contra o próprio Supabase passa a rodar a própria instância do projeto, com as próprias variáveis de ambiente. Os campos de URL e chave anon em Configurações continuam funcionando: apontar o painel para outro Supabase segue disponível.
- O script que aplica o tema salvo antes da primeira pintura saiu do HTML e virou um arquivo próprio, o que permite uma política de scripts mais estrita sem enfraquecer a proteção contra XSS.
### Fixed
- Fechada uma falha de segurança: o endpoint que registrava as conexões de terceiros aceitava, sem autenticação nenhuma, a chave de service role do Supabase e a senha de app do Gmail de qualquer visitante — e o endereço informado não era conferido contra uma lista de domínios permitidos, o que permitia fazer o servidor consultar um host arbitrário todos os dias.
- Os tokens de administração e do cron passaram a ser comparados em tempo constante, para que o tempo de resposta não revele quanto de uma tentativa estava correto.
- O manifesto de dependências do projeto não é mais embutido no pacote público, onde expunha a lista completa de bibliotecas e versões exatas, inclusive as usadas só em desenvolvimento.
- Removidos da raiz do repositório um `package.json`, um `package-lock.json` e um `requirements.txt` órfãos, que declaravam dependências que nenhum arquivo do projeto importava.

## [1.6.0] - 2026-07-31
### Added
- Cada evento no "Rastreamento da mensagem" (página de detalhes do evento) agora mostra os dados mais relevantes do próprio card, sem precisar entrar em cada evento: origem/IP/configuration set no envio, tempo de processamento e resposta SMTP na entrega, tipo/subtipo de bounce e diagnostic code no bounce, tipo de feedback na reclamação, e o motivo da falha em atrasos, rejeições e falhas de renderização.
### Changed
- O card de "Rastreamento da mensagem" passou a ser exibido dentro do painel de detalhes do evento, logo após o resumo, em vez de abaixo dele.
- Resultados da investigação por destinatário redesenhados como cartões com borda de destaque colorida conforme o status do evento (entregue, bounce, reclamação, etc.).
- Fundo do painel ganhou uma grade e um brilho decorativos sutis, com rodapé, FAQ e tabela de relatórios agendados adaptados para funcionar também no tema claro.
### Fixed
- Corrigido um erro ao abrir o rastreamento de uma mensagem a partir de um identificador que não é um UUID válido (ex.: um message ID do SES).
- A linha do tempo do rastreamento agora prioriza o messageId (compartilhado por todos os eventos do ciclo de vida da mensagem) em vez do snsMessageId (único por notificação) ao reunir os eventos relacionados.

## [1.5.0] - 2026-07-31
### Added
- Nova busca global no cabeçalho, disponível em qualquer página, com um modo "Todos os campos" e persistência do texto, modo e filtros de busca entre navegações (inclusive após recarregar a página).
- Resultados da investigação por destinatário redesenhados em cartões, com uma descrição em linguagem simples para cada status de evento (enviado, entregue, devolvido, etc.).
- Página de Relatórios agendados reorganizada em abas ("Agendamentos", "Entrega automática" e "Configuração"), em vez de empilhar tudo na mesma tela.
- Emails de relatório agendado agora trazem uma seção "O que fazer com este relatório" quando o filtro inclui eventos de problema, explicando em linguagem simples o que um bounce/rejeição/reclamação costuma significar e destacando clientes com problema recorrente há mais de 30 dias.
### Changed
- O modo de busca "Origem" foi renomeado para "Provedor" e agora busca pelo domínio do email do destinatário (ex.: gmail.com), em vez dos campos de origem do envio.

## [1.4.0] - 2026-07-31
### Added
- Disparo periódico dos relatórios agendados agora passa por um workflow do GitHub Actions (a cada 15 minutos), além do cron da Vercel — que fica só como reforço diário. Antes, o cron da Vercel era o único disparo e rodava só 1x por dia (23:00 UTC), então um agendamento configurado para um horário como "12:00" só saía horas depois, à noite; agora sai perto do horário configurado.
### Changed
- Textos do painel "Configuração necessária" (Relatórios agendados) atualizados para explicar os dois disparos (GitHub Actions + Vercel Cron) e como cadastrar o secret `CRON_SECRET` no repositório.

## [1.3.0] - 2026-07-30
### Added
- Qualquer visitante do dashboard agora pode registrar o próprio projeto Supabase e a própria conta Gmail ("Entrega automática para o seu Supabase", na página de Relatórios agendados) para receber os relatórios que criar automaticamente, sem que o dono deste site veja seus dados ou credenciais — armazenadas criptografadas.
### Changed
- Na página de Relatórios agendados: o painel "Configuração necessária" agora começa fechado e fica abaixo da lista de agendamentos (antes vinha aberto e no topo); os botões de ação de cada agendamento não quebram mais em várias linhas; o aviso de última execução foi resumido para "Enviado"; e o título da seção de agendamentos passou a ser "Seus agendamentos".
### Fixed
- Fechada uma falha de segurança: qualquer visitante sem login conseguia criar agendamentos direto no Supabase padrão deste site (RLS aberto para a chave anon embutida no bundle), fazendo o cron enviá-los pelo Gmail do dono do site. A gestão de agendamentos do projeto padrão agora exige um token de administrador, configurado só pelo dono.

## [1.2.1] - 2026-07-30
### Fixed
- Logo do Seslock Holmes no cabeçalho do email de relatório aparecia como um quadrado quebrado no Gmail em produção — o Gmail não renderiza de forma confiável imagens embutidas como `data:` URI. A logo agora é servida como um arquivo estático de verdade.

## [1.2.0] - 2026-07-30
### Changed
- Redesenhado o email de relatório agendado: cabeçalho com a logo do Seslock Holmes, cartões de resumo, chips com os filtros aplicados e tabela de categorias com listras — junto com uma versão em texto puro enviada em paralelo e um cabeçalho `List-Unsubscribe`, para reduzir a chance do email cair na caixa de spam.

## [1.1.2] - 2026-07-30
### Fixed
- Botão "Forçar agendamento de relatório": a correção da versão anterior não foi suficiente — os imports internos do módulo de relatórios agendados ainda precisavam da extensão `.js` explícita para o Node conseguir resolvê-los em produção. Confirmado pelos logs reais da function na Vercel.

## [1.1.1] - 2026-07-30
### Fixed
- Botão "Forçar agendamento de relatório" voltou a funcionar: o módulo compartilhado dos relatórios agendados estava sendo importado dinamicamente pelas duas funções da API, o que a Vercel não empacota corretamente e derrubava o envio com "Cannot find module" em produção.

## [1.1.0] - 2026-07-30
### Added
- Botão "Forçar agendamento de relatório" na página de Relatórios agendados, que gera e envia o relatório de um agendamento imediatamente (útil para testes ou situações críticas), sem alterar a próxima execução programada pelo cron.

## [1.0.0] - 2026-07-30
Primeira versão estável do dashboard, marcando o app como completo e em uso em produção.

### Fixed
- Ajustada a largura das colunas do painel de filtros e do overlay de busca do Overview, que ficavam espremidos em telas médias.

## [0.15.0] - 2026-07-30
### Added
- Nova página "Relatórios agendados" na sidebar, para configurar entregas recorrentes do relatório de emails com os mesmos filtros do Overview, um horário/frequência (diário, semanal ou mensal) e uma lista de destinatários por email.
- Painel de Configuração guiado na nova página, que detecta se as tabelas de agendamento existem no Supabase do usuário e gera o SQL da migration pronto para copiar, sem exigir nenhuma credencial de conta inteira dentro do app.
- Histórico de execuções por agendamento, com re-download do relatório em CSV, PDF ou JSON a partir do resultado salvo de cada envio.
- Entrega automática dos relatórios por email (via Resend) através de uma function do Vercel disparada por um cron diário, reaproveitando a mesma hospedagem do dashboard.

## [0.14.0] - 2026-07-30
### Added
- Recipient search and filters moved from the overview page body into the topbar, staying reachable without scrolling.
- Configurable page size for the recent activity table (5/10/50/100 rows), instead of a fixed 50.
- Supabase credentials are now validated (URL shape, key format, and a live connection check) before being saved in onboarding and settings.

### Changed
- Redesigned the event detail page with an icon-led hero, grouped info rows with copy buttons, a collapsible raw payload viewer, and an automatic bounce-diagnosis callout.
- The message trace timeline now highlights the event currently being viewed.

### Fixed
- Restored missing accents in Portuguese bounce diagnosis text and made keyword matching diacritic-insensitive.
- The report export menu now closes when clicking outside of it.
- Fixed a dark-mode contrast issue on the default badge tone.

## [0.13.0] - 2026-07-29
### Added
- Supabase onboarding screen that gates the dashboard until a project URL and key are connected, with a shortcut to full settings for advanced options.
- A light-mode variant of the logo, now shown in the sidebar, dashboard header, and onboarding screen.
- Bounce and complaint stat tiles now change color and show a warning icon once they cross unhealthy thresholds.
- Recent activity rows show separate "De"/"Para" (from/to) lines and a compact actions menu with a dedicated copy-sender option.

### Changed
- Top providers and bounce reasons bars now show a true percentage of the total instead of scaling relative to the largest item.
- The overview dashboard keeps the previous data visible (dimmed) while a new query is fetching, instead of flashing a loading state.

## [0.7.0] - 2026-07-10
### Added
- Bounce diagnostic search mode in the investigation flow, allowing operators to search failure causes and recommendations directly.
- Overview-style filters in the investigation page, including time window, status, origin, provider, and recent activity sorting.

### Changed
- Updated safe npm dependencies, including Supabase, React Query, Vite, Vitest, PostCSS, Node types, and the Vite React plugin.
- Investigation searches now preserve and apply provider filters across submit, pagination, and related-email navigation.
- README and project metadata were refreshed after the latest dashboard changes.

### Fixed
- Kept the investigation provider filter wired into the Supabase query path so filtered searches match the UI state.
- Ignored local Docker-only files in Git.

## [0.6.2] - 2026-07-02
### Changed
- Email lists in the overview and recipient investigation views now surface the subject inline so operators can identify recurring patterns faster without opening details.

## [0.6.1] - 2026-07-01
### Fixed
- Replaced non-generic provider examples with neutral `example.com` placeholders so the project stays safe to share publicly.

## [0.6.0] - 2026-07-01
### Added
- Overview provider filter with `Todos` support, allowing the dashboard to narrow metrics and tables to a specific recipient domain.
- Short bounce reason details in the overview table, with friendly labels such as `MailboxFull` -> `Caixa do email cheia`.
- Recipient-domain filtering helper coverage for provider-scoped investigation workflows.

### Changed
- Overview analytics now compute from provider-filtered events when a provider is selected.
- Overview filters gained a dedicated provider field alongside the existing origin filter.

### Fixed
- Improved table sizing and card layout so the overview tables use the available card width cleanly.

## [0.5.0] - 2026-07-01
### Added
- New overview analytics visuals with percentage-based event-distribution bars and color-coded states.
- Favicon, footer metadata improvements, and new display settings for timezone, clock format, and update interval.
- Overview metrics support and related regression tests.

### Changed
- Refined FAQ, settings, and overview layouts for better spacing, alignment, and card structure.
- Updated TypeScript path configuration and footer timestamp handling.

### Fixed
- Overview card layout issues, misaligned content blocks, and inconsistent bar-fill rendering.

## [0.3.0] - 2026-06-29
### Added
- Sticky, unified search panels under the navbar for both Overview and `/investigate` pages.
- Hover-expand behavior for filter panels: filters are hidden by default and reveal on hover.

### Changed
- Converted search/filter panels to a dark theme and standardized input/select/button styles.
- Removed `focus-within` expansion to ensure filters hide on mouse leave after clicks.

### Fixed
- Small JSX/format issues preventing builds and layout inconsistencies.

---

## [0.2.1] - previous
- Prior release notes.
