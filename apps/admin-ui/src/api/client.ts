/**
 * API client for the admin UI.
 * Wraps fetch with JWT auth headers and error handling.
 * @module admin-ui/api/client
 */

const API_BASE = '/api';

/**
 * Make an authenticated API request.
 * Automatically attaches the JWT access token from localStorage.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('sc_access_token');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data.data as T;
}

/** Shorthand for GET requests */
export function apiGet<T>(path: string) {
  return apiRequest<T>(path, { method: 'GET' });
}

/** Shorthand for POST requests */
export function apiPost<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Shorthand for PATCH requests */
export function apiPatch<T>(path: string, body: unknown) {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Shorthand for PUT requests */
export function apiPut<T>(path: string, body: unknown) {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** Shorthand for DELETE requests */
export function apiDelete(path: string) {
  return apiRequest(path, { method: 'DELETE' });
}
