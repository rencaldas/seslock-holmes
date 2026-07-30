---
name: "finalizar-pr"
description: "Fecha o ciclo de uma feature/fix: cria conventional commits das alterações pendentes, faz o bump de versão do projeto (package.json + CHANGELOG.md) quando aplicável, e abre uma Pull Request detalhada em português usando o template fixo do time, sem Claude como co-autor."
metadata:
  author: "rencaldas"
---

## Entrada do usuário

```text
$ARGUMENTS
```

Se o usuário passou argumentos (ex.: um resumo do que foi feito, ou instruções como "não faz bump de versão"), leve isso em conta antes de prosseguir.

## Objetivo

Automatizar o encerramento de um ciclo de trabalho neste repositório:

1. Organizar as alterações pendentes em commits no padrão [Conventional Commits](https://www.conventionalcommits.org/).
2. Se o projeto tiver versionamento (ex.: `frontend/package.json` + `frontend/CHANGELOG.md` neste repo), atualizar a versão de acordo com o tipo de mudança, sem quebrar o build.
3. Abrir uma Pull Request no GitHub com o template fixo abaixo, em português, **sem Claude/Anthropic como co-autor**.

## Restrições importantes

- **Nunca** commitar diretamente na branch `main`. Se a branch atual for `main`/`master`, crie e mude para uma branch nova antes de commitar (nome no padrão `tipo/descricao-curta`, ex.: `feat/relatorio-por-categoria`).
- **Nunca** inclua o trailer `Co-Authored-By: Claude ...` nem o rodapé "🤖 Generated with Claude Code" nos commits desta skill — isso é o que faz o Claude aparecer como co-autor no PR. Essa é uma instrução explícita do usuário que sobrescreve o comportamento padrão apenas para esta skill.
- **Nunca** quebre o código para fechar um bump de versão mais rápido. Rode as verificações disponíveis antes de finalizar (ver Passo 2).
- Se algo estiver ambíguo (ex.: como agrupar commits, qual o tipo de bump), prefira decidir com bom senso e seguir; só pare para perguntar se for uma decisão que só o usuário pode tomar (ex.: título de PR muito subjetivo, ou risco real de dado/infra).
- `git push` (branch e tags) e `gh pr create` são ações visíveis para outras pessoas. Antes de rodar, mostre um resumo rápido (commits + versão nova e tag, se houver) e só então prossiga — a menos que o usuário já tenha pedido explicitamente para não parar.

## Passo 1 — Levantar o estado atual

Rode em paralelo:
- `git status` (nunca use `-uall`)
- `git diff` e `git diff --staged`
- `git log --oneline -15` (para reconhecer o padrão de commits já usado no repo: `feat(escopo): ...`, `fix(escopo): ...`, `chore(release): bump version to X.Y.Z`, etc.)
- `git branch --show-current`

Se não houver nenhuma alteração pendente (staged, unstaged ou untracked) e a branch atual já estiver com commits não mergeados à frente de `main`, pule direto para o Passo 4 (abrir o PR com o que já existe). Se não houver absolutamente nada para fazer, informe o usuário e pare.

## Passo 2 — Commits (Conventional Commits)

1. Agrupe as mudanças por unidade lógica (não faça um único commit gigante misturando tipos diferentes; não crie granularidade excessiva para uma mudança pequena e coesa).
2. Para cada grupo, escolha o tipo correto: `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `build`, `ci`, `chore`. Use escopo entre parênteses quando fizer sentido (ex.: `feat(overview): ...`, `fix(email-report): ...`), seguindo o padrão já usado no `git log` deste repo.
3. Antes de commitar mudanças em `frontend/`, rode as verificações relevantes disponíveis (`npm run typecheck`, `npm run build`, e a suíte de testes se fizer sentido para o escopo alterado) a partir de `frontend/`. Corrija problemas simples que a própria mudança introduziu. Se encontrar um problema que não é seu de corrigir agora (pré-existente, fora de escopo), **não** commit quebrado — pare e reporte ao usuário em vez de mascarar o erro.
4. `git add` apenas os arquivos relevantes de cada grupo (nunca `git add -A`/`git add .` às cegas — confira com `git status` o que está sendo staged).
5. Commit sem o trailer de co-autoria do Claude (ver Restrições). Mensagem no formato:
   ```
   tipo(escopo): resumo curto no imperativo

   Corpo opcional explicando o porquê, se não for óbvio.
   ```

## Passo 3 — Bump de versão (se aplicável)

Este repo versiona o frontend em `frontend/package.json` (`"version"`) e mantém `frontend/CHANGELOG.md`. Só faça esse passo se as mudanças commitadas neste ciclo justificarem uma nova versão (mudança de código relevante — não é necessário para um typo de doc, por exemplo).

1. Olhe os tipos dos commits deste ciclo desde o último bump (`chore(release): bump version to X.Y.Z` no `git log`) para decidir o incremento semver:
   - Qualquer `!` de breaking change ou "BREAKING CHANGE" no corpo → **major**.
   - Algum `feat` → **minor**.
   - Só `fix`/`perf`/outros sem `feat` → **patch**.
   - Mudanças puramente de `docs`/`style`/`test`/`ci` isoladas geralmente não justificam bump — use bom senso.
2. Atualize `"version"` em `frontend/package.json` para o novo valor.
3. Adicione uma entrada nova no topo de `frontend/CHANGELOG.md`, seguindo exatamente o formato já usado no arquivo:
   ```
   ## [X.Y.Z] - AAAA-MM-DD
   ### Added
   - ...
   ### Changed
   - ...
   ### Fixed
   - ...
   ```
   Inclua só as seções (`Added`/`Changed`/`Fixed`) que tiverem itens neste ciclo. Use a data de hoje. Escreva os itens em português, no mesmo tom do restante do changelog (frases descritivas, não apenas o texto do commit).
4. Rode `npm run build` (e `npm run typecheck`) em `frontend/` de novo depois do bump para garantir que nada quebrou.
5. Commit essa alteração isolada como `chore(release): bump version to X.Y.Z` (mesmo padrão dos commits `041a659`, `4acb527`, `46572b9` já existentes no histórico).
6. Crie a tag de versão correspondente:
   - Rode `git tag --list "v*" --sort=-v:refname` para ver se o projeto já usa tags de versão (`git ls-remote --tags origin` também, caso as tags locais estejam desatualizadas em relação ao remoto).
   - Se já existirem tags no padrão `vX.Y.Z`, crie a nova seguindo o mesmo padrão: `git tag -a vX.Y.Z -m "vX.Y.Z"` no commit do bump.
   - Se o projeto **não tiver nenhuma tag ainda**, crie a primeira agora (padrão `vX.Y.Z`, ex.: `v1.0.0` ou a versão atual do `package.json`, o que fizer mais sentido dado o histórico) — não pergunte, apenas siga a convenção semver já usada no `package.json`/`CHANGELOG.md`.
   - Não faça `git push --tags` ainda — a tag só vai para o remoto junto com o push do Passo 4, para o usuário poder revisar antes.

## Passo 4 — Push e Pull Request

1. Confirme a branch atual não é `main`/`master`. Se as mudanças foram commitadas direto numa branch nova, tudo bem.
2. `git push -u origin <branch>`. Se uma tag de versão foi criada no Passo 3, dê push nela também (`git push origin vX.Y.Z`) — só depois que o push da branch tiver sucesso.
3. Reúna o contexto do PR: `git log --oneline main..HEAD` e `git diff main...HEAD --stat` para saber exatamente o que entra.
4. Abra o PR com `gh pr create`, com o corpo passado via heredoc, seguindo **exatamente** este template (em português, preenchido com o conteúdo real da mudança — não deixe placeholders):

```markdown
## Pull Request: [Tipo]: [Descrição do que foi feito]

### Contexto e Motivação
[Descreva o porquê desta PR.]

### Mudanças e Impacto
[Liste as mudanças de alto nível, numeradas.]

### 🧪 Instruções de Teste (Como o revisor pode testar)
[Descreva os passos exatos para testar a funcionalidade ou verificar a correção.]

---

### ✅ Checklist de Qualidade
* [ ] Testes automatizados (Unitários/Integração) passaram.
* [ ] O código foi revisado pelo autor (Self-Review).
* [ ] Não há código comentado ou arquivos desnecessários.
* [ ] As instruções de teste (se aplicável) foram fornecidas na descrição.
```

- `[Tipo]` deve refletir o tipo predominante do ciclo (ex.: `Feature`, `Fix`, `Refactor`, `Chore`).
- Marque no checklist apenas os itens que você de fato verificou (rodou testes, rodou self-review, conferiu que não sobrou código comentado). Não marque algo que não foi checado.
- **Não** adicione linha de co-autoria do Claude nem menção ao Claude Code no corpo do PR.
- Título do PR: `tipo(escopo): resumo curto`, coerente com o commit principal do ciclo.

5. Ao final, devolva ao usuário o link do PR criado.
