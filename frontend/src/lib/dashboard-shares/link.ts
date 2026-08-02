// Monta e lê a URL pública de um link de dashboard compartilhado.
//
// A URL carrega url/key/table do projeto Supabase de origem como query
// params, porque quem abre /share/:token não tem Configurações salvas nem
// sessão — precisa saber a qual projeto se conectar antes de sequer chamar
// get_shared_dashboard. Isso não expõe nada que já não fosse público: a anon
// key é feita para ir no navegador (a segurança de fato está na RLS do banco
// e, aqui, na validação do token), e é exatamente o mesmo valor que já
// aparece no bundle do projeto padrão ou no localStorage de quem configurou
// um projeto próprio.

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
