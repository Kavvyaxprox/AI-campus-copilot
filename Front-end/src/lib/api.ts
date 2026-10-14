import type { LoginResponse, PublicProfile, Session } from './types';

const API_PORT = 4000;

/**
 * API origin:
 *   1. VITE_API_URL when it is explicitly set.
 *   2. Otherwise the same host as this page on port 4000, so the app works
 *      from localhost, 127.0.0.1 or a LAN address without reconfiguration.
 */
function resolveApiBase(): string {
  const explicit = import.meta.env.VITE_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  if (!host || host === '') return `http://localhost:${API_PORT}`;
  const bracketed = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${bracketed}:${API_PORT}`;
}

export const API_BASE = resolveApiBase();

const STORAGE_KEY = 'campus-copilot.session';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registered by the auth provider so a 401 anywhere clears the session. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.user || !parsed?.claims) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
}

function describeNetworkFailure(path: string): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'This page was opened as a local file. Run "npm run dev" in Front-end and use the http:// address it prints.';
  }
  return `Cannot reach the API at ${API_BASE}${path}. Start the backend with "npm run dev" in the Backend folder, then reload.`;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = options.token !== undefined ? options.token : readSession()?.token;

  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body,
    });
  } catch {
    throw new ApiError(0, describeNetworkFailure(path));
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // Non JSON error body, keep the status based message.
    }
    if (response.status === 401) unauthorizedHandler?.();
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    token: null,
  });
}

export async function profileRequest(): Promise<{ user: PublicProfile }> {
  return apiFetch<{ user: PublicProfile }>('/api/auth/me');
}
