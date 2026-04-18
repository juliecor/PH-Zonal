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

// ── Cached user profile ───────────────────────────────────────────────────────

const USER_KEY = "zonalUser";

export function getCachedUser(): Record<string, any> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function apiMe(): Promise<{
  id: number;
  name: string;
  email: string;
  role?: string;
  token_balance?: number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  company?: string;
  bio?: string;
  avatar_path?: string;
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

// --- Concerns (client) ---
export async function apiCreateConcern(payload: {
  category?: string;
  subject: string;
  message: string;
  attachmentFile?: File | null;
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const hasFile = Boolean(payload.attachmentFile);
  let res: Response;
  if (hasFile) {
    const fd = new FormData();
    if (payload.category) fd.append("category", payload.category);
    fd.append("subject", payload.subject);
    fd.append("message", payload.message);
    if (payload.attachmentFile) fd.append("attachment", payload.attachmentFile);
    res = await fetch(`${backendBase}/api/concerns`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
  } else {
    res = await fetch(`${backendBase}/api/concerns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ category: payload.category, subject: payload.subject, message: payload.message }),
    });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Submit failed (${res.status})`);
  }
  return await res.json();
}

export async function apiMyConcerns(params?: { page?: number }) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const qs = params?.page ? `?page=${params.page}` : "";
  const res = await fetch(`${backendBase}/api/concerns/mine${qs}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return await res.json();
}

// --- Concerns (admin) ---
export async function apiAdminListConcerns(status?: string, page?: number) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ status, page }).filter(([, v]) => v != null && v !== "") as any
    )
  ).toString();
  const res = await fetch(`${backendBase}/api/admin/concerns${qs ? `?${qs}` : ""}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return await res.json();
}

export async function apiAdminResolveConcern(id: number, resolutionFile?: File | null, note?: string) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  let res: Response;
  if (resolutionFile) {
    const fd = new FormData();
    fd.append("resolution", resolutionFile);
    if (note) fd.append("note", note);
    res = await fetch(`${backendBase}/api/admin/concerns/${id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      body: fd,
    });
  } else {
    res = await fetch(`${backendBase}/api/admin/concerns/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: note || "" }),
    });
  }
  if (!res.ok) throw new Error(`Resolve failed (${res.status})`);
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

// --- Admin counts (badges) ---
export async function apiAdminPendingCounts(): Promise<{ tokenRequests: number; concerns: number }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` } as const;

  // Request minimal data but keep pagination meta for totals
  const [trRes, cRes] = await Promise.all([
    fetch(`${backendBase}/api/admin/token-requests?status=pending&per_page=1`, { headers }),
    fetch(`${backendBase}/api/admin/concerns?status=pending&per_page=1`, { headers }),
  ]);

  let trTotal = 0, cTotal = 0;
  try {
    if (trRes.ok) {
      const j = await trRes.json();
      trTotal = typeof j.total === "number" ? j.total : Array.isArray(j.data) ? j.data.length : 0;
    }
  } catch {}
  try {
    if (cRes.ok) {
      const j = await cRes.json();
      cTotal = typeof j.total === "number" ? j.total : Array.isArray(j.data) ? j.data.length : 0;
    }
  } catch {}

  return { tokenRequests: trTotal, concerns: cTotal };
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

// --- Profile (client & admin) ---
export function setCachedUser(user: any) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
}

export async function apiGetProfile() {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${backendBase}/api/profile`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return await res.json();
}

export async function apiUpdateProfile(payload: Partial<{
  first_name: string;
  middle_name: string;
  last_name: string;
  phone: string;
  address: string;
  company: string;
  bio: string;
  name: string;
}>) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${backendBase}/api/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Update failed (${res.status})`);
  }
  const j = await res.json();
  setCachedUser(j);
  return j;
}

export async function apiUploadAvatar(file: File) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const fd = new FormData();
  fd.append("avatar", file);
  const res = await fetch(`${backendBase}/api/profile/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Upload failed (${res.status})`);
  }
  const j = await res.json();
  setCachedUser(j.user);
  return j;
}

// --- Admin invitations ---
export async function apiAdminInviteUsers(params: { emails: string[]; redirect_url?: string }) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const payload: Record<string, any> = { emails: params.emails };
  if (params.redirect_url) payload.redirect_url = params.redirect_url;

  const res = await fetch(`${backendBase}/api/admin/invitations`, {
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
    throw new Error(t || `Invite failed (${res.status})`);
  }

  return await res.json();
}