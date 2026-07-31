// Local storage for the ONE piece of state that proves a browser registered
// a "connection" (its own external Supabase project + Gmail account) with
// the hub's report_connections table — see api/connections.ts. The token is
// generated server-side and shown exactly once; after that, only whoever's
// browser has it saved can manage (check status on, delete) that connection.
// There is deliberately no way to recover a lost token.

export interface StoredConnection {
  connectionId: string;
  token: string;
}

const STORAGE_KEY = "seslock-holmes.scheduled-reports.connection";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadStoredConnection(): StoredConnection | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConnection>;
    if (typeof parsed.connectionId === "string" && typeof parsed.token === "string") {
      return { connectionId: parsed.connectionId, token: parsed.token };
    }
  } catch {
    // ignore malformed storage
  }

  return null;
}

export function saveStoredConnection(connection: StoredConnection) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export function clearStoredConnection() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
