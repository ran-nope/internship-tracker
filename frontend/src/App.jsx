import { useEffect, useRef, useState } from "react"
import "./App.css"

import { apiRequest } from "./api"

const STATUSES = [
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Selected",
  "Rejected",
  "Withdrawn",
]

const EMPTY_FORM = {
  company: "",
  role: "",
  status: "Applied",
  application_date: "",
  location: "",
  job_url: "",
  notes: "",
}


// ---------------- MAIN APP ----------------

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  )

  const sessionVersion = useRef(0)

  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const [internships, setInternships] = useState([])
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editingId, setEditingId] = useState(null)

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("All")

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")


  // ---------------- LOAD INTERNSHIPS ----------------

  useEffect(() => {
    if (!token) return

    let cancelled = false

    async function loadInternships() {
      setLoading(true)
      setError("")

      try {
        const data = await apiRequest(
          "/internships",
          {},
          token
        )

        if (!cancelled) {
          setInternships(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadInternships()

    return () => {
      cancelled = true
    }
  }, [token])


  // ---------------- LOGIN / SIGNUP ----------------

  async function handleSubmit(event) {
    event.preventDefault()

    setError("")
    setSuccess("")

    if (!username.trim() || !password) {
      setError("Please enter your username and password.")
      return
    }

    setLoading(true)

    try {
      const endpoint = isLogin ? "/login" : "/signup"

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })

      if (isLogin) {
        localStorage.setItem("token", data.access_token)
        localStorage.setItem("username", data.username)

        setToken(data.access_token)
        setPassword("")
        setSuccess("Login successful!")
      } else {
        setSuccess("Account created! You can now log in.")
        setIsLogin(true)
        setPassword("")
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }


  // ---------------- FORM HANDLING ----------------

  function updateField(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function clearForm() {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
  }


  // ---------------- ADD / UPDATE ----------------

  async function saveInternship(event) {
    event.preventDefault()
    if (loading || saving || deletingId !== null) return

    setError("")
    setSuccess("")

    if (
      !form.company.trim() ||
      !form.role.trim() ||
      !form.application_date
    ) {
      setError("Company, role, and application date are required.")
      return
    }

    if (
      form.job_url.trim() &&
      !/^https?:\/\/\S+/i.test(form.job_url.trim())
    ) {
      setError("Job URL must start with http:// or https://")
      return
    }

    const payload = {
      ...form,
      company: form.company.trim(),
      role: form.role.trim(),
      location: form.location.trim() || null,
      job_url: form.job_url.trim() || null,
      notes: form.notes.trim() || null,
    }

    const requestSession = sessionVersion.current
    setSaving(true)

    try {
      if (editingId !== null) {
        const updated = await apiRequest(
          `/internships/${editingId}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
          token
        )

        if (sessionVersion.current !== requestSession) return

        setInternships((previous) =>
          previous.map((item) =>
            item.id === editingId ? updated : item
          )
        )

        setSuccess("Internship updated successfully!")
      } else {
        const created = await apiRequest(
          "/internships",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token
        )

        if (sessionVersion.current !== requestSession) return

        setInternships((previous) => [
          created,
          ...previous,
        ])

        setSuccess("Internship added successfully!")
      }

      clearForm()
    } catch (err) {
      if (sessionVersion.current === requestSession) setError(err.message)
    } finally {
      if (sessionVersion.current === requestSession) setSaving(false)
    }
  }


  // ---------------- EDIT ----------------

  function editInternship(internship) {
    setForm({
      company: internship.company || "",
      role: internship.role || "",
      status: internship.status || "Applied",
      application_date: internship.application_date || "",
      location: internship.location || "",
      job_url: internship.job_url || "",
      notes: internship.notes || "",
    })

    setEditingId(internship.id)
    setError("")
    setSuccess("")

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }


  // ---------------- DELETE ----------------

  async function deleteInternship(id) {
    if (saving || deletingId !== null) return
    if (!window.confirm("Delete this internship permanently?")) {
      return
    }

    setError("")
    setSuccess("")

    const requestSession = sessionVersion.current
    setDeletingId(id)
    try {
      await apiRequest(
        `/internships/${id}`,
        { method: "DELETE" },
        token
      )

      if (sessionVersion.current !== requestSession) return

      setInternships((previous) =>
        previous.filter((item) => item.id !== id)
      )

      if (editingId === id) {
        clearForm()
      }

      setSuccess("Internship deleted successfully!")
    } catch (err) {
      if (sessionVersion.current === requestSession) setError(err.message)
    } finally {
      if (sessionVersion.current === requestSession) setDeletingId(null)
    }
  }


  // ---------------- LOGOUT ----------------

  function logout() {
    sessionVersion.current += 1
    setLoading(false)
    setSaving(false)
    setDeletingId(null)
    setSearch("")
    setFilterStatus("All")
    localStorage.removeItem("token")
    localStorage.removeItem("username")

    setToken(null)
    setInternships([])
    clearForm()
    setError("")
    setSuccess("")
  }


  // ---------------- DASHBOARD STATISTICS ----------------

  const total = internships.length

  const applied = internships.filter(
    (item) => item.status === "Applied"
  ).length

  const interviews = internships.filter(
    (item) => item.status === "Interview"
  ).length

  const selected = internships.filter(
    (item) => item.status === "Selected"
  ).length

  const rejected = internships.filter(
    (item) => item.status === "Rejected"
  ).length

  const selectionRate = total
    ? ((selected / total) * 100).toFixed(1)
    : "0.0"


  // ---------------- SEARCH / FILTER ----------------

  const filteredInternships = internships.filter((item) => {
    const query = search.toLowerCase()

    const matchesSearch =
      item.company.toLowerCase().includes(query) ||
      item.role.toLowerCase().includes(query) ||
      (item.location || "").toLowerCase().includes(query)

    const matchesStatus =
      filterStatus === "All" ||
      item.status === filterStatus

    return matchesSearch && matchesStatus
  })


  // ==================================================
  // LOGIN / SIGNUP SCREEN
  // ==================================================

  if (!token) {
    return (
      <div className="auth-container">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Internship Tracker</h1>

          <p>
            Track applications. Manage opportunities.
          </p>

          <h2>
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>

          {error && <div className="message error">{error}</div>}
          {success && <div className="message success">{success}</div>}

          <input
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isLogin
                ? "Login"
                : "Sign Up"}
          </button>

          <p
            className="switch-auth"
            onClick={() => {
              setIsLogin((previous) => !previous)
              setError("")
              setSuccess("")
            }}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Login"}
          </p>
        </form>
      </div>
    )
  }


  // ==================================================
  // DASHBOARD
  // ==================================================

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>Internship Tracker</h1>
            <p>
              Welcome, {localStorage.getItem("username")}
            </p>
          </div>

          <button className="logout" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="message error">
          {error}
        </div>
      )}

      {success && (
        <div className="message success">
          {success}
        </div>
      )}


      {/* DASHBOARD */}

      <section className="dashboard">
        <div className="stat-card">
          <h3>Total Applications</h3>
          <p>{total}</p>
        </div>

        <div className="stat-card">
          <h3>Applied</h3>
          <p>{applied}</p>
        </div>

        <div className="stat-card">
          <h3>Interviews</h3>
          <p>{interviews}</p>
        </div>

        <div className="stat-card">
          <h3>Selected</h3>
          <p>{selected}</p>
        </div>

        <div className="stat-card">
          <h3>Rejected</h3>
          <p>{rejected}</p>
        </div>

        <div className="stat-card">
          <h3>Selection Rate</h3>
          <p>{selectionRate}%</p>
        </div>
      </section>


      {/* ADD / EDIT FORM */}

      <section className="form-section">
        <h2>
          {editingId !== null
            ? "Edit Internship"
            : "Add Internship"}
        </h2>

        <form className="form" onSubmit={saveInternship}>
          <fieldset disabled={loading || saving || deletingId !== null} className="form-fields">
          <input
            name="company"
            placeholder="Company *"
            value={form.company}
            onChange={updateField}
            maxLength={200}
            required
          />

          <input
            name="role"
            placeholder="Role *"
            value={form.role}
            onChange={updateField}
            maxLength={200}
            required
          />

          <input
            name="application_date"
            type="date"
            value={form.application_date}
            onChange={updateField}
            required
          />

          <select
            name="status"
            value={form.status}
            onChange={updateField}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <input
            name="location"
            placeholder="Location (e.g. Bengaluru)"
            value={form.location}
            onChange={updateField}
          />

          <input
            name="job_url"
            type="url"
            placeholder="Job application URL"
            value={form.job_url}
            onChange={updateField}
          />

          <textarea
            name="notes"
            placeholder="Notes (skills, deadlines, contacts...)"
            value={form.notes}
            onChange={updateField}
            rows={3}
          />

          <button type="submit" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId !== null
                ? "Update Internship"
                : "Add Internship"}
          </button>

          {editingId !== null && (
            <button
              type="button"
              className="cancel"
              onClick={clearForm}
            >
              Cancel
            </button>
          )}
          </fieldset>
        </form>
      </section>


      {/* INTERNSHIP LIST */}

      <section className="internships-section">
        <h2>My Internships</h2>

        <div className="filters">
          <input
            type="search"
            placeholder="Search company, role, or location..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="All">All Statuses</option>

            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Loading internships...</p>
        ) : filteredInternships.length === 0 ? (
          <p>No internships found. Add one to get started!</p>
        ) : (
          <div className="internship-list">
            {filteredInternships.map((internship) => (
              <article
                className="internship-card"
                key={internship.id}
              >
                <div className="internship-details">
                  <h3>{internship.company}</h3>
                  <p>{internship.role}</p>

                  <span className="status">
                    {internship.status}
                  </span>

                  <p className="application-date">
                    Applied on:{" "}
                    {new Date(
                      `${internship.application_date}T00:00:00`
                    ).toLocaleDateString("en-GB")}
                  </p>

                  {internship.location && (
                    <p>
                      <strong>Location:</strong>{" "}
                      {internship.location}
                    </p>
                  )}

                  {internship.job_url && (
                    <p>
                      <strong>Job URL:</strong>{" "}
                      <a
                        href={internship.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View application
                      </a>
                    </p>
                  )}

                  {internship.notes && (
                    <div className="internship-notes">
                      <strong>Notes:</strong>
                      <p>{internship.notes}</p>
                    </div>
                  )}
                </div>

                <div className="actions">
                  <button
                    className="edit"
                    disabled={saving || deletingId !== null}
                    onClick={() => editInternship(internship)}
                  >
                    Edit
                  </button>

                  <button
                    className="delete"
                    disabled={saving || deletingId !== null}
                    onClick={() => deleteInternship(internship.id)}
                  >
                    {deletingId === internship.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default App
