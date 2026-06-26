export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem("hermesConsoleToken") || "";
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export function apiErrorMessage(error: unknown, fallback = "Request failed") {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  return fallback;
}

export function postJson<T = any>(path: string, body: unknown): Promise<T> {
  return api(path, { method: "POST", body: JSON.stringify(body) });
}

export function putJson<T = any>(path: string, body: unknown): Promise<T> {
  return api(path, { method: "PUT", body: JSON.stringify(body) });
}

export function deleteJson<T = any>(path: string): Promise<T> {
  return api(path, { method: "DELETE" });
}
