export type SupabaseCredentialErrorCode = "invalidUrl" | "invalidKey" | "credentialsRejected" | "connectionFailed";

export interface SupabaseCredentialValidation {
  valid: boolean;
  errorCode?: SupabaseCredentialErrorCode;
}

const JWT_KEY_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const NEW_FORMAT_KEY_PATTERN = /^sb_(publishable|secret)_[A-Za-z0-9_-]+$/;

export function parseSupabaseUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function isPlausibleSupabaseKey(value: string): boolean {
  return JWT_KEY_PATTERN.test(value) || NEW_FORMAT_KEY_PATTERN.test(value);
}

export async function validateSupabaseCredentials(
  url: string,
  anonKey: string,
): Promise<SupabaseCredentialValidation> {
  const parsedUrl = parseSupabaseUrl(url);
  if (!parsedUrl) {
    return { valid: false, errorCode: "invalidUrl" };
  }

  if (!isPlausibleSupabaseKey(anonKey)) {
    return { valid: false, errorCode: "invalidKey" };
  }

  let response: Response;
  try {
    // auth/v1/settings accepts anon/publishable keys and reliably distinguishes
    // a wrong key (401) from a wrong/unreachable URL (network error or non-2xx),
    // unlike rest/v1/ which now requires a secret key for its root/introspection route.
    response = await fetch(new URL("/auth/v1/settings", parsedUrl.origin), {
      method: "GET",
      headers: { apikey: anonKey },
    });
  } catch {
    return { valid: false, errorCode: "connectionFailed" };
  }

  if (response.status === 401 || response.status === 403) {
    return { valid: false, errorCode: "credentialsRejected" };
  }

  if (!response.ok) {
    return { valid: false, errorCode: "connectionFailed" };
  }

  return { valid: true };
}
