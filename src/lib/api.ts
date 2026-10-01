export interface ApiError {
  code: string;
  message: string;
}

const TOKEN_STORAGE_KEY = 'caselens_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token && token.trim().length > 0) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Gracefully ignore storage quota / sandbox exceptions
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach Bearer token fallback if present
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Clear invalid/expired token if an authenticated endpoint rejects with 401
    if (response.status === 401 && token) {
      clearAuthToken();
    }

    const errorData = data?.error || {
      code: `HTTP_${response.status}`,
      message: typeof data === 'string' && data ? data : response.statusText || 'An error occurred'
    };
    throw errorData;
  }

  return data as T;
}
