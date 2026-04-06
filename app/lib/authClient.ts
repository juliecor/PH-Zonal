export const backendBase =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export type AuthResponse = {
  user: { id: number; name: string; email: string; role?: string };
  token: string;
};

// ✅ Added proper error type
type ApiError = {
  message?: string;
  errors?: Record<string, string[]>;
};

export async function apiRegister(payload: {
  first_name: string;
  middle_name?: string;
  last_name: string;
  phone?: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${backendBase}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let j: ApiError | null = null;
    try {
      j = await res.json();
    } catch {}

    // ✅ SAFE extraction (no TS error)
    const firstError = j?.errors
      ? Object.values(j.errors)[0]?.[0]
      : undefined;

    const msg =
      j?.message || firstError || `Register failed (${res.status})`;

    throw { message: msg, errors: j?.errors, status: res.status } as any;
  }

  return (await res.json()) as AuthResponse;
}

export async function apiLogin(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${backendBase}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let j: ApiError | null = null;
    try {
      j = await res.json();
    } catch {}

    const msg = j?.message || `Login failed (${res.status})`;

    throw { message: msg, errors: j?.errors, status: res.status } as any;
  }

  return (await res.json()) as AuthResponse;
}

export function setToken(token: string) {
  try {
    document.cookie = `authToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}`;
    localStorage.setItem("authToken", token);

    try {
      localStorage.removeItem("zv.lowbalance.snoozeUntil");
      localStorage.removeItem("zv.lowbalance.lastBalance");
    } catch {}
  } catch {}
}

export function clearToken() {
  try {
    document.cookie = `authToken=; path=/; max-age=0`;
    localStorage.removeItem("authToken");

    try {
      localStorage.removeItem("zv.lowbalance.snoozeUntil");
      localStorage.removeItem("zv.lowbalance.lastBalance");
    } catch {}
  } catch {}
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const m = document.cookie.match(/(?:^|; )authToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : localStorage.getItem("authToken");
  } catch {
    return null;
  }
}

export async function apiMe(): Promise<{
  id: number;
  name: string;
  email: string;
  role?: string;
  token_balance?: number;
} | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${backendBase}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;

  return await res.json();
}

export async function apiLogout(): Promise<void> {
  const token = getToken();
  if (!token) return;

  try {
    await fetch(`${backendBase}/api/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } finally {
    clearToken();
  }
}

// --- Token requests (client) ---
export async function apiCreateTokenRequest(payload: {
  quantity: number;
  message?: string;
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${backendBase}/api/token-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Request failed (${res.status})`);
  }

  return await res.json();
}

export async function apiMyTokenRequests() {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${backendBase}/api/token-requests/mine`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

  return await res.json();
}

// --- Admin token request APIs ---
export async function apiAdminListTokenRequests(status?: string) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const q = status ? `?status=${encodeURIComponent(status)}` : "";

  const res = await fetch(
    `${backendBase}/api/admin/token-requests${q}`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

  return await res.json();
}

export async function apiAdminApproveTokenRequest(id: number) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(
    `${backendBase}/api/admin/token-requests/${id}/approve`,
    {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error(`Approve failed (${res.status})`);

  return await res.json();
}

export async function apiAdminDenyTokenRequest(id: number) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(
    `${backendBase}/api/admin/token-requests/${id}/deny`,
    {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error(`Deny failed (${res.status})`);

  return await res.json();
}

// --- Reports (client) ---
export async function apiCreateReport(payload: {
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zonal_value?: string;
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${backendBase}/api/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Create failed (${res.status})`);

  return await res.json();
}

export async function apiMyReports(params?: {
  page?: number;
  per_page?: number;
  city?: string;
  from?: string;
  to?: string;
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const qs = params
    ? "?" +
      new URLSearchParams(
        Object.entries(params).filter(
          ([, v]) => v != null && v !== ""
        ) as any
      ).toString()
    : "";

  const res = await fetch(`${backendBase}/api/reports/mine${qs}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

  return await res.json();
}