// Trava de regressão para GHSA-wrjc-x8rr-h8h6 (open redirect via backslash em
// <Link> e useNavigate), que afeta todo o react-router 6.0.0–7.17.0.
//
// A 6.30.4 que usamos está dentro do range vulnerável e não existe correção na
// linha 6.x — a 6.30.4 é a última. Corrigir exigiria migrar para a v7, uma
// major que toca todas as rotas. A auditoria mediu a exposição real como nula
// e optou-se por permanecer na 6.30.4, com esta trava no lugar.
//
// A CVE só é explorável quando um valor controlado por terceiros define o
// INÍCIO do destino da navegação (ex.: `\\evil.com` ou `//evil.com` sendo
// tratado como URL absoluta). Hoje toda navegação do app começa com um caminho
// literal (`/events/`, `/investigate?`, `/settings`), então o trecho dinâmico
// nunca ocupa a primeira posição e não consegue trocar a origem.
//
// Este teste garante que essa propriedade continue valendo: qualquer destino
// novo que não comece com literal falha aqui e força uma revisão consciente.
// Se a exceção for legítima, adicione-a a ALLOWED_DYNAMIC_TARGETS com a
// justificativa. Quando migrarmos para a v7, este arquivo pode ser removido.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Destinos que não começam com literal mas foram verificados manualmente.
const ALLOWED_DYNAMIC_TARGETS: Record<string, string> = {
  // sidebar.tsx: vem de um array local estático com os 5 caminhos fixos do
  // menu ("/", "/investigate", "/scheduled-reports", "/faq", "/settings").
  // Nenhum valor externo alcança essa lista.
  "item.to": "array de navegação estático definido no próprio componente",
  // event-detail-page.tsx: computado como "/investigate" ou
  // `/investigate?query=${encodeURIComponent(...)}&mode=recipient` — os dois
  // ramos começam com literal.
  backLink: "ambos os ramos começam com o literal /investigate",
};

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    const isSource = /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry);
    return isSource ? [fullPath] : [];
  });
}

// Lê uma expressão delimitada por chaves contando profundidade, para não se
// perder com as interpolações `${...}` de template literals.
function readBracedExpression(source: string, openBraceIndex: number): string {
  let depth = 1;
  let index = openBraceIndex + 1;

  while (index < source.length && depth > 0) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") depth -= 1;
    index += 1;
  }

  return source.slice(openBraceIndex + 1, index - 1).trim();
}

function readCallArgument(source: string, startIndex: number): string {
  let depth = 1;
  let index = startIndex;

  while (index < source.length && depth > 0) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") depth -= 1;
    index += 1;
  }

  return source.slice(startIndex, index - 1).trim();
}

interface NavigationTarget {
  file: string;
  expression: string;
}

function extractNavigationTargets(filePath: string): NavigationTarget[] {
  const source = readFileSync(filePath, "utf8");
  const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, "/");
  const targets: NavigationTarget[] = [];

  for (const match of source.matchAll(/\bnavigate\(\s*/g)) {
    const expression = readCallArgument(source, match.index + match[0].length);
    targets.push({ file: relativePath, expression });
  }

  for (const match of source.matchAll(/\bto=/g)) {
    const valueIndex = match.index + match[0].length;
    const firstCharacter = source[valueIndex];

    if (firstCharacter === '"' || firstCharacter === "'") {
      const closingIndex = source.indexOf(firstCharacter, valueIndex + 1);
      targets.push({ file: relativePath, expression: source.slice(valueIndex, closingIndex + 1) });
    } else if (firstCharacter === "{") {
      targets.push({ file: relativePath, expression: readBracedExpression(source, valueIndex) });
    }
  }

  return targets;
}

// Seguro quando a expressão abre com aspas/backtick seguidos de "/", ou seja,
// o caminho começa com literal e o trecho dinâmico nunca é o primeiro.
function startsWithLiteralPath(expression: string): boolean {
  return /^["'`]\//.test(expression);
}

describe("segurança de navegação (react-router 6.30.4)", () => {
  const targets = collectSourceFiles(SRC_DIR).flatMap(extractNavigationTargets);

  it("encontra as navegações do app", () => {
    // Guarda contra o scanner quebrar silenciosamente e passar por vacuidade.
    expect(targets.length).toBeGreaterThanOrEqual(13);
  });

  it("não permite destino sem caminho literal no início", () => {
    const unexpected = targets.filter(
      (target) =>
        !startsWithLiteralPath(target.expression) &&
        !(target.expression in ALLOWED_DYNAMIC_TARGETS),
    );

    expect(
      unexpected.map((target) => `${target.file}: ${target.expression}`),
      "Destino de navegação que não começa com caminho literal. Enquanto " +
        "estivermos no react-router 6.30.4 (GHSA-wrjc-x8rr-h8h6), um valor " +
        "externo na primeira posição pode virar redirecionamento para outra " +
        "origem. Garanta o prefixo literal ou adicione a exceção, com " +
        "justificativa, em ALLOWED_DYNAMIC_TARGETS.",
    ).toEqual([]);
  });

  it("mantém as exceções conhecidas em uso", () => {
    // Exceção que deixou de existir deve sair da lista, para ela não virar
    // um passe-livre esquecido para um símbolo futuro de mesmo nome.
    const dynamicExpressions = new Set(
      targets.filter((target) => !startsWithLiteralPath(target.expression)).map((target) => target.expression),
    );

    for (const allowed of Object.keys(ALLOWED_DYNAMIC_TARGETS)) {
      expect(dynamicExpressions, `exceção obsoleta: ${allowed}`).toContain(allowed);
    }
  });
});
