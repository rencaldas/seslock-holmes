// Monta e lê a URL pública de um link de dashboard compartilhado. A URL
// carrega url/key/table do projeto Supabase de origem como query params —
// quem abre /share/:token não tem Configurações salvas nem sessão. Isso não
// expõe nada de novo; ver docs/SECURITY.md#links-de-compartilhamento.

export interface ShareLinkParams {
  token: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  eventsTable: string;
}

export function buildShareUrl({ token, supabaseUrl, supabaseAnonKey, eventsTable }: ShareLinkParams): string {
  const params = new URLSearchParams({
    url: supabaseUrl,
    key: supabaseAnonKey,
    table: eventsTable,
  });

  return `${window.location.origin}/share/${token}?${params.toString()}`;
}

export interface ParsedShareLink {
  supabaseUrl: string;
  supabaseAnonKey: string;
  eventsTable: string;
}

export function parseShareLinkParams(searchParams: URLSearchParams): ParsedShareLink | null {
  const supabaseUrl = searchParams.get("url");
  const supabaseAnonKey = searchParams.get("key");
  const eventsTable = searchParams.get("table") || "aws_sns";

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey, eventsTable };
}
