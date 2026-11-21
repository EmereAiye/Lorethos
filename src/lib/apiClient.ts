const SESSION_TOKEN_KEY = 'lorethos_session_token';
let inMemoryToken: string | null = null;

export function getStoredSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const stored = window.localStorage.getItem(SESSION_TOKEN_KEY);
    if (stored) {
      inMemoryToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage errors in restricted iframes
  }
  return null;
}

export function setStoredSessionToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted iframes
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getStoredSessionToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  try {
    const response = await fetch(input, {
      ...init,
      credentials: 'include',
      headers,
    });
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine !== false) {
      window.dispatchEvent(new CustomEvent('lorethos:network-online'));
    }
    return response;
  } catch (err) {
    if (typeof window !== 'undefined' && (typeof navigator === 'undefined' || !navigator.onLine || err instanceof TypeError)) {
      window.dispatchEvent(new CustomEvent('lorethos:network-offline'));
    }
    throw err;
  }
}

export async function parseJsonSafe<T = Record<string, unknown>>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
