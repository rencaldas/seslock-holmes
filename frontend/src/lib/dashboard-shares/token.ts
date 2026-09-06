// Token opaco de 256 bits para links de dashboard compartilhados. Gerado e
// hasheado no navegador com Web Crypto; só o hash vai para o banco. Ver
// docs/SECURITY.md#links-de-compartilhamento para o modelo completo.

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
