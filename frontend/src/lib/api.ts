import type {
  Alert,
  Dashboard,
  IngestOut,
  ReadingIn,
  Resource,
  Score,
  Series,
  Settings,
  SettingsIn,
  SpikeOut,
  Tariffs,
  Tip,
  TokenOut,
  User,
} from "./types";

// Same origin by default (/api is proxied by Vite in dev). Set VITE_API_URL for
// a build served from another origin than the API.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "tg-token";

let token: string | null = readToken();
let onUnauthorized: (() => void) | null = null;

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session simply won't survive a reload */
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** FastAPI errors: {detail: "text"} or {detail: [{loc, msg}]} (422) or {detail: {message}}. */
function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        return field ? `${field} : ${d.msg}` : (d.msg ?? "");
      })
      .join(" · ");
  }
  if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: string }).message);
  if (status === 0) return "Serveur injoignable. Vérifie que l'API tourne.";
  if (status >= 500) return "Erreur du serveur. Réessaie dans un instant.";
  return `Erreur ${status}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  deviceKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (deviceKey) headers["X-Device-Key"] = deviceKey;
  else if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, errorMessage(0, null));
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    // A refused device key must not log the user out.
    if (res.status === 401 && token && !deviceKey && !path.startsWith("/api/auth/login")) {
      setToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(res.status, errorMessage(res.status, data));
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface SeriesQuery {
  resource: Resource;
  from?: string;
  to?: string;
  bucket?: "auto" | "raw" | "minute" | "hour" | "day";
}

export const api = {
  login: (email: string, password: string) => request<TokenOut>("POST", "/api/auth/login", { email, password }),
  me: () => request<User>("GET", "/api/auth/me"),
  dashboard: (signal?: AbortSignal) => request<Dashboard>("GET", "/api/dashboard", undefined, signal),
  readings: (q: SeriesQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ resource: q.resource });
    if (q.from) params.set("from", q.from);
    if (q.to) params.set("to", q.to);
    if (q.bucket) params.set("bucket", q.bucket);
    return request<Series>("GET", `/api/readings?${params}`, undefined, signal);
  },
  alerts: (status: "active" | "all" = "all", signal?: AbortSignal) =>
    request<Alert[]>("GET", `/api/alerts?status=${status}&limit=100`, undefined, signal),
  ackAlert: (id: string) => request<Alert>("POST", `/api/alerts/${id}/ack`),
  tips: (signal?: AbortSignal) => request<Tip[]>("GET", "/api/tips", undefined, signal),
  score: (signal?: AbortSignal) => request<Score>("GET", "/api/score", undefined, signal),
  settings: (signal?: AbortSignal) => request<Settings>("GET", "/api/settings", undefined, signal),
  updateSettings: (body: SettingsIn) => request<Settings>("PUT", "/api/settings", body),
  tariffs: (signal?: AbortSignal) => request<Tariffs>("GET", "/api/tariffs", undefined, signal),
  updateTariffs: (body: Tariffs) => request<Tariffs>("PUT", "/api/tariffs", body),
  /** POST /api/readings as a device (the virtual box at /esp), with its X-Device-Key. */
  sendReading: (payload: ReadingIn, deviceKey: string) =>
    request<IngestOut>("POST", "/api/readings", payload, undefined, deviceKey),
  spike: (body?: { extra_w?: number; duration_s?: number; energy_kwh?: number | null }) =>
    request<SpikeOut>("POST", "/api/demo/spike", body ?? {}),
  health: () => request<{ status: string; demo_mode: boolean }>("GET", "/api/health"),
};
