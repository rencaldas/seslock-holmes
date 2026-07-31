// Thin client for /api/connections — see that file for the server-side
// half (encryption, RLS-locked hub table) and connection-settings.ts for
// where the resulting { connectionId, token } gets persisted in this browser.

export interface ConnectionInput {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  gmailUser: string;
  gmailAppPassword: string;
  gmailFromName?: string;
  label?: string;
}

export interface ConnectionStatus {
  connectionId: string;
  label: string | null;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
}

async function parseErrorBody(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || `HTTP ${response.status}`;
}

export async function createConnection(input: ConnectionInput): Promise<{ connectionId: string; token: string }> {
  const response = await fetch("/api/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }

  return (await response.json()) as { connectionId: string; token: string };
}

export async function getConnectionStatus(connectionId: string, token: string): Promise<ConnectionStatus> {
  const params = new URLSearchParams({ connectionId, token });
  const response = await fetch(`/api/connections?${params.toString()}`);

  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }

  return (await response.json()) as ConnectionStatus;
}

export async function deleteConnection(connectionId: string, token: string): Promise<void> {
  const params = new URLSearchParams({ connectionId, token });
  const response = await fetch(`/api/connections?${params.toString()}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }
}
