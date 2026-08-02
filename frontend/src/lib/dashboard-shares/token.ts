// Token opaco de 256 bits para links de dashboard compartilhados.
//
// Gerado e hasheado inteiramente no navegador com Web Crypto (crypto.subtle
// exige um contexto seguro — https ou localhost — que é sempre o caso aqui).
// Só o hash SHA-256 (hex) vai para o banco, em dashboard_shares.token_hash;
// o texto puro só existe na URL mostrada uma vez a quem cria o link. A
// função get_shared_dashboard (ver a migration 20260802120000) refaz o mesmo
// hash com pgcrypto.digest() do lado do servidor para comparar — SHA-256 do
// mesmo texto produz o mesmo hex nos dois lados.

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashShareToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}
