/**
 * Shared API Client utilities.
 *
 * Provides common helpers used by every feature's api/ layer:
 * - resolveUrl: build an absolute URL when running outside the browser (tests)
 * - getAuthHeaders: attach Authorization header from localStorage token
 * - handleResponse: extract `data` from the standard envelope, throw on errors
 *
 * Design reference: docs/module-design/web-app.md §6 "API Client 配置"
 */

export interface ApiError {
  code: string;
  message: string;
}

/**
 * Resolve a relative API path to a full URL.
 * In the browser the path is returned as-is (Vite proxy handles it).
 * In non-browser environments (e.g. tests) an absolute localhost URL is built.
 */
export function resolveUrl(path: string): string {
  if (typeof globalThis.location !== 'undefined') {
    return path;
  }
  return `http://localhost${path}`;
}

/**
 * Build request headers that include Content-Type and, when a token is
 * present in localStorage, the Authorization bearer header.
 */
export function getAuthHeaders(): Record<string, string> {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Process a fetch Response using the project's standard JSON envelope.
 *
 * - On success (2xx): returns `body.data` typed as T.
 * - On failure: throws an Error with a `.code` property extracted from
 *   `body.error`.
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    const error = body.error as ApiError;
    const err = new Error(error.message) as Error & { code: string };
    err.code = error.code;
    throw err;
  }

  return body.data as T;
}
