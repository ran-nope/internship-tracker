export function normalizeApiUrl(value) {
  const normalized = value.trim().replace(/\/+$/, "")
  let parsed
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error("VITE_API_URL must be an absolute http:// or https:// URL")
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username || parsed.password || parsed.search || parsed.hash
  ) {
    throw new Error("VITE_API_URL must use HTTP(S) without credentials, a query, or a fragment")
  }
  return normalized
}

const API_URL = normalizeApiUrl(
  import.meta.env.VITE_API_URL?.trim() ||
    (import.meta.env.PROD
      ? "https://internship-tracker-ak3q.onrender.com"
      : "http://127.0.0.1:8000")
)

export async function apiRequest(path, options = {}, token = null) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${API_URL}/${path.replace(/^\/+/, "")}`, {
    ...options,
    headers,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    // An old request must not log out a newer session.
    if (response.status === 401 && token && localStorage.getItem("token") === token) {
      localStorage.removeItem("token")
      localStorage.removeItem("username")
      window.location.reload()
    }
    const detail = data.detail || data.error
    const message = Array.isArray(detail)
      ? detail.map((item) => `${(item.loc || []).join(".")}: ${item.msg}`).join("; ")
      : typeof detail === "string" ? detail : `Request failed (${response.status})`
    throw new Error(message)
  }
  return data
}
