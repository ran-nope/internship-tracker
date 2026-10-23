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

  let response
  try {
    response = await fetch(`${API_URL}/${path.replace(/^\/+/, "")}`, {
      ...options,
      headers,
    })
  } catch (error) {
    if (error.name === "AbortError") throw error
    throw new Error("Unable to reach the API. Check your connection and try again.", { cause: error })
  }
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    // An old request must not log out a newer session.
    if (response.status === 401 && token && localStorage.getItem("token") === token) {
      localStorage.removeItem("token")
      localStorage.removeItem("username")
      window.location.reload()
    }
    const detail = data?.detail || data?.error
    const message = Array.isArray(detail)
      ? detail.filter((item) => item && typeof item.msg === "string")
        .map((item) => `${Array.isArray(item.loc) ? item.loc.join(".") : "Request"}: ${item.msg}`).join("; ")
      : typeof detail === "string" ? detail : `Request failed (${response.status})`
    throw new Error(message || `Request failed (${response.status})`)
  }
  const endpoint = path.replace(/^\/+/, "")
  const method = (options.method || "GET").toUpperCase()
  const isInternship = (item) => item && Number.isInteger(item.id) && item.id > 0 &&
    ["company", "role", "status", "application_date"].every((field) => typeof item[field] === "string") &&
    ["location", "job_url", "notes"].every((field) => item[field] == null || typeof item[field] === "string")
  let valid = data !== null
  if (endpoint === "internships" && method === "GET") {
    valid = Array.isArray(data) && data.every(isInternship)
  } else if ((endpoint === "internships" && method === "POST") ||
             (/^internships\/\d+$/.test(endpoint) && method === "PUT")) {
    valid = isInternship(data)
  } else if (endpoint === "login" && method === "POST") {
    valid = typeof data?.access_token === "string" && !!data.access_token && typeof data.username === "string"
  }
  if (!valid) throw new Error("The API returned an invalid response. Please try again.")
  return data
}
