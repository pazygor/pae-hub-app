// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP central da integração com o back-end (pae-api).
// Responsável por: URL base, injeção do token JWT, desembrulho do envelope
// { data, meta } e renovação automática de token no 401.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

const ACCESS_KEY = 'pae.accessToken';
const REFRESH_KEY = 'pae.refreshToken';

/** Armazenamento dos tokens. Em produção (Fase 6) reavaliar cookie httpOnly. */
export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Erro tipado de API — carrega o status HTTP e o corpo de erro do back. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Anexa o Authorization: Bearer. Padrão true; use false em login/refresh. */
  auth?: boolean;
  /** Uso interno: evita loop de refresh. */
  _retry?: boolean;
}

// De-duplica refreshes concorrentes (vários 401 ao mesmo tempo).
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          tokenStore.clear();
          return false;
        }
        const json = await res.json();
        const data = json?.data ?? json;
        if (data?.accessToken && data?.refreshToken) {
          tokenStore.set(data.accessToken, data.refreshToken);
          return true;
        }
        tokenStore.clear();
        return false;
      } catch {
        tokenStore.clear();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, _retry, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };
  if (auth) {
    const token = tokenStore.getAccess();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 → tenta renovar o token uma vez e repete a requisição.
  if (res.status === 401 && auth && !_retry) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, { ...options, _retry: true });
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }

  // Desembrulha o envelope { data, meta } do back-end.
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  del: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'DELETE' }),
};

export { BASE_URL };
