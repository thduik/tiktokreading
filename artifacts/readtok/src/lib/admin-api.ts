const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export interface AdminSession {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
}

export interface AdminReportItem {
  passage_id: string;
  title: string;
  band_label: string;
  question_set_type_label: string;
  factory_tag: string;
  status: string;
  total_count: number;
  latest_reported_at: string;
  reports: Array<{
    report_type: string;
    count: number;
    updated_at: string;
  }>;
}

export interface AdminReportsResponse {
  items: AdminReportItem[];
  summary: {
    reported_passage_count: number;
    total_report_count: number;
  };
}

async function parseError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // no-op
  }
  return `Request failed (${response.status})`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export async function fetchAdminSession() {
  return requestJson<AdminSession>(`${API_BASE}/admin/session`);
}

export async function loginAdmin({
  username,
  password,
}: {
  username: string;
  password: string;
}) {
  return requestJson<{ ok: true; username: string }>(`${API_BASE}/admin/login`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutAdmin() {
  return requestJson<{ ok: true }>(`${API_BASE}/admin/logout`, {
    method: "POST",
  });
}

export async function fetchAdminReports() {
  return requestJson<AdminReportsResponse>(`${API_BASE}/admin/reports?limit=300`);
}

