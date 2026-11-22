import type {
  AdminDevice,
  AdminHousehold,
  AdminSystem,
  AdminUser,
  Alert,
  Appliance,
  ApplianceCatalogItem,
  ApplianceIn,
  ChatOut,
  ChatTurn,
  CodeSent,
  Dashboard,
  DeviceCreated,
  HistoryMonth,
  Household,
  HouseholdIn,
  Insights,
  Lang,
  Notification,
  NotifyPrefs,
  TariffAudit,
  Ticket,
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
const HOUSEHOLD_KEY = "tg-household";

let token: string | null = readToken();
let householdId: string | null = readKey(HOUSEHOLD_KEY);
let onUnauthorized: (() => void) | null = null;

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function readToken(): string | null {
  return readKey(TOKEN_KEY);
}

/** The home every household endpoint works on (sent as X-Household-Id). */
export function getHouseholdId(): string | null {
  return householdId;
}

export function setHouseholdId(id: string | null): void {
  householdId = id;
  try {
    if (id) localStorage.setItem(HOUSEHOLD_KEY, id);
    else localStorage.removeItem(HOUSEHOLD_KEY);
  } catch {
    /* kept in memory */
  }
}

export function getToken(): string | null {
  return token;
}

/** remember = false keeps the session for this browser tab only ("Se souvenir de moi" off). */
export function setToken(value: string | null, remember = true): void {
  token = value;
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (value) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, value);
  } catch {
    /* private mode: the session only lives in memory */
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Machine code from the API, e.g. "email_not_verified". */
    public code?: string,
  ) {
    super(message);
  }
}

function errorCode(body: unknown): string | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === "object" && "code" in detail) return String((detail as { code: string }).code);
  return undefined;
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
  else if (token) {
    headers.Authorization = `Bearer ${token}`;
    if (householdId) headers["X-Household-Id"] = householdId;
  }

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
    const message = errorMessage(res.status, data);
    // The chosen home was deleted: fall back to the first one on the next call.
    if (res.status === 404 && headers["X-Household-Id"] && message === "Foyer introuvable") setHouseholdId(null);
    throw new ApiError(res.status, message, errorCode(data));
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
  login: (email: string, password: string, remember = false) =>
    request<TokenOut>("POST", "/api/auth/login", { email, password, remember }),
  register: (body: { full_name: string; email: string; password: string; language: Lang }) =>
    request<CodeSent>("POST", "/api/auth/register", body),
  verifyEmail: (email: string, code: string) => request<TokenOut>("POST", "/api/auth/verify-email", { email, code }),
  resendCode: (email: string) => request<CodeSent>("POST", "/api/auth/resend-code", { email }),
  forgotPassword: (email: string) => request<CodeSent>("POST", "/api/auth/forgot-password", { email }),
  resetPassword: (email: string, code: string, new_password: string) =>
    request<null>("POST", "/api/auth/reset-password", { email, code, new_password }),
  me: () => request<User>("GET", "/api/auth/me"),
  updateMe: (body: { full_name?: string; language?: Lang; notify_prefs?: NotifyPrefs }) =>
    request<User>("PATCH", "/api/auth/me", body),
  changePassword: (current_password: string, new_password: string) =>
    request<TokenOut>("POST", "/api/auth/change-password", { current_password, new_password }),
  logoutAll: () => request<null>("POST", "/api/auth/logout-all"),
  deleteAccount: (password: string, confirm: string) => request<null>("DELETE", "/api/auth/me", { password, confirm }),

  households: (signal?: AbortSignal) => request<Household[]>("GET", "/api/households", undefined, signal),
  createHousehold: (body: HouseholdIn) => request<Household>("POST", "/api/households", body),
  updateHousehold: (id: string, body: HouseholdIn) => request<Household>("PUT", `/api/households/${id}`, body),
  deleteHousehold: (id: string) => request<null>("DELETE", `/api/households/${id}`),
  addDevice: (id: string, kind: "esp32" | "simulator") =>
    request<DeviceCreated>("POST", `/api/households/${id}/devices`, { kind }),

  applianceCatalog: (signal?: AbortSignal) =>
    request<ApplianceCatalogItem[]>("GET", "/api/appliances/catalog", undefined, signal),
  appliances: (signal?: AbortSignal) => request<Appliance[]>("GET", "/api/appliances", undefined, signal),
  addAppliance: (body: ApplianceIn) => request<Appliance>("POST", "/api/appliances", body),
  updateAppliance: (id: string, body: ApplianceIn) => request<Appliance>("PUT", `/api/appliances/${id}`, body),
  deleteAppliance: (id: string) => request<null>("DELETE", `/api/appliances/${id}`),
  replaceAppliances: (items: ApplianceIn[], finish_onboarding = true) =>
    request<Appliance[]>("POST", "/api/appliances/bulk", { items, finish_onboarding }),

  insights: (signal?: AbortSignal) => request<Insights>("GET", "/api/insights", undefined, signal),
  history: (months = 12, signal?: AbortSignal) =>
    request<{ months: HistoryMonth[]; is_estimate: boolean }>("GET", `/api/history?months=${months}`, undefined, signal),
  chat: (message: string, language: Lang, history: ChatTurn[]) =>
    request<ChatOut>("POST", "/api/assistant/chat", { message, language, history }),

  notifications: (status: "unread" | "all" = "all", type = "all", signal?: AbortSignal) =>
    request<Notification[]>("GET", `/api/notifications?status=${status}&type=${type}&limit=200`, undefined, signal),
  readNotification: (id: string) => request<Notification>("POST", `/api/notifications/${id}/read`),
  readAll: (householdId?: string) =>
    request<{ updated: number }>("POST", `/api/notifications/read-all${householdId ? `?household_id=${householdId}` : ""}`),

  createTicket: (body: { category: string; subject: string; message: string }) =>
    request<Ticket>("POST", "/api/support/tickets", body),
  myTickets: (signal?: AbortSignal) => request<Ticket[]>("GET", "/api/support/tickets", undefined, signal),

  admin: {
    users: (q = "", signal?: AbortSignal) =>
      request<AdminUser[]>("GET", `/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`, undefined, signal),
    setUserStatus: (id: string, status: "active" | "suspended") =>
      request<AdminUser>("PATCH", `/api/admin/users/${id}`, { status }),
    households: (signal?: AbortSignal) => request<AdminHousehold[]>("GET", "/api/admin/households", undefined, signal),
    devices: (signal?: AbortSignal) => request<AdminDevice[]>("GET", "/api/admin/devices", undefined, signal),
    system: (signal?: AbortSignal) => request<AdminSystem>("GET", "/api/admin/system", undefined, signal),
    tariffAudit: (signal?: AbortSignal) => request<TariffAudit[]>("GET", "/api/admin/tariff-audit", undefined, signal),
    tickets: (signal?: AbortSignal) => request<Ticket[]>("GET", "/api/admin/tickets", undefined, signal),
    setTicketStatus: (id: string, status: "open" | "answered" | "closed") =>
      request<Ticket>("PATCH", `/api/admin/tickets/${id}`, { status }),
  },

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
