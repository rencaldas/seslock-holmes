import { describe, expect, it } from "vitest";
import { isPermissionDeniedError } from "./auth";

// Esta função decide se o usuário vê a tela de login ou uma mensagem de erro
// sem saída. Um falso negativo deixa alguém preso num "algo deu errado" sem
// nenhum caminho para entrar; um falso positivo pede login para um problema
// que login nenhum resolve (rede fora, tabela inexistente).
describe("isPermissionDeniedError", () => {
  it("reconhece o insufficient_privilege do PostgreSQL", () => {
    expect(isPermissionDeniedError({ code: "42501", message: "permission denied for table aws_sns" })).toBe(true);
  });

  it("reconhece o JWT ausente/expirado do PostgREST", () => {
    expect(isPermissionDeniedError({ code: "PGRST301", message: "JWT expired" })).toBe(true);
  });

  it("reconhece 401 e 403 pelo status", () => {
    expect(isPermissionDeniedError({ status: 401, message: "Unauthorized" })).toBe(true);
    expect(isPermissionDeniedError({ status: 403, message: "Forbidden" })).toBe(true);
  });

  it("reconhece pelo texto quando o código não vem", () => {
    expect(isPermissionDeniedError({ message: "permission denied for relation aws_sns" })).toBe(true);
    expect(isPermissionDeniedError({ message: "JWT expired" })).toBe(true);
  });

  it("é indiferente à caixa da mensagem", () => {
    expect(isPermissionDeniedError({ message: "Permission Denied for table aws_sns" })).toBe(true);
  });

  // Estes são os falsos positivos que mais importam: nenhum deles melhora com
  // login, e pedir credenciais aqui esconderia a causa real.
  it("não confunde tabela inexistente com falta de permissão", () => {
    expect(
      isPermissionDeniedError({ code: "42P01", message: 'relation "aws_sns" does not exist' }),
    ).toBe(false);
  });

  it("não confunde coluna inexistente com falta de permissão", () => {
    expect(
      isPermissionDeniedError({ code: "42703", message: 'column "timestamp" does not exist' }),
    ).toBe(false);
  });

  it("não trata falha de rede como falta de permissão", () => {
    expect(isPermissionDeniedError(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("não trata erro 500 como falta de permissão", () => {
    expect(isPermissionDeniedError({ status: 500, message: "Internal Server Error" })).toBe(false);
  });

  // A armadilha que derrubou o painel em produção uma vez. A RLS não gera
  // erro em SELECT: sem policy que case, o PostgREST devolve 200 com lista
  // vazia — não há erro nenhum para classificar, então esta função nunca é
  // chamada e a tela de login nunca aparece.
  //
  // Este teste não consegue pegar isso sozinho (o bug estava na premissa, não
  // no código), mas trava a metade que dá para travar: resultado vazio nunca
  // deve ser lido como falta de permissão. O que faz a recusa virar erro de
  // verdade é o GRANT revogado no banco — ver o comentário de topo em auth.ts
  // e a migration 20260801025740.
  it("não confunde resposta bem-sucedida e vazia com falta de permissão", () => {
    expect(isPermissionDeniedError({ status: 200, data: [], error: null })).toBe(false);
    expect(isPermissionDeniedError({ data: [], count: 0 })).toBe(false);
  });

  it("sobrevive a entradas que não são objeto de erro", () => {
    expect(isPermissionDeniedError(null)).toBe(false);
    expect(isPermissionDeniedError(undefined)).toBe(false);
    expect(isPermissionDeniedError("permission denied")).toBe(false);
    expect(isPermissionDeniedError(42)).toBe(false);
    expect(isPermissionDeniedError({})).toBe(false);
  });
});
