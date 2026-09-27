import { useEffect, useState } from "react"
import "./App.css"

function App() {

  const [token, setToken] = useState(
    localStorage.getItem("token")
  )

  const [isLogin, setIsLogin] = useState(true)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const [internships, setInternships] = useState([])

  const [company, setCompany] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("Applied")
  const [applicationDate, setApplicationDate] = useState("")
  const [editingId, setEditingId] = useState(null)

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("All")


  // ---------------- LOGIN / SIGNUP ----------------

  const handleSubmit = () => {

    if (!username || !password) {
      alert("Please enter username and password")
      return
    }

    const endpoint = isLogin ? "login" : "signup"

    fetch(`http://127.0.0.1:8000/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    })
      .then(response => response.json())
      .then(data => {

        if (data.error) {
          alert(data.error)
          return
        }

        alert(data.message)

        if (isLogin) {

          localStorage.setItem(
            "token",
            data.access_token
          )

          localStorage.setItem(
            "username",
            data.username
          )

          setToken(data.access_token)
        }

      })
  }


  // ---------------- GET INTERNSHIPS ----------------

  useEffect(() => {

    if (!token) return

    fetch(
      "http://127.0.0.1:8000/internships",
      {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    )
      .then(response => response.json())
      .then(data => setInternships(data))

  }, [token])


  // ---------------- ADD ----------------

  const addInternship = () => {

    if (!company || !role || !applicationDate) {
      alert("Please fill all fields")
      return
    }

    fetch(
      "http://127.0.0.1:8000/internships",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },

        body: JSON.stringify({
          company,
          role,
          status,
          application_date: applicationDate
        })
      }
    )
      .then(response => response.json())
      .then(data => {

        setInternships([
          ...internships,
          data
        ])

        clearForm()

      })
  }


  // ---------------- UPDATE ----------------

  const updateInternship = () => {

    fetch(
      `http://127.0.0.1:8000/internships/${editingId}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },

        body: JSON.stringify({
          company,
          role,
          status,
          application_date: applicationDate
        })
      }
    )
      .then(response => response.json())
      .then(data => {

        setInternships(
          internships.map(internship =>
            internship.id === editingId
              ? data
              : internship
          )
        )

        clearForm()

      })
  }


  // ---------------- DELETE ----------------

  const deleteInternship = (id) => {

    fetch(
      `http://127.0.0.1:8000/internships/${id}`,
      {
        method: "DELETE",

        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    )
      .then(response => response.json())
      .then(() => {

        setInternships(
          internships.filter(
            internship => internship.id !== id
          )
        )

      })
  }


  // ---------------- EDIT ----------------

  const editInternship = (internship) => {

    setCompany(internship.company)
    setRole(internship.role)
    setStatus(internship.status)
    setApplicationDate(internship.application_date)
    setEditingId(internship.id)

  }


  // ---------------- CLEAR FORM ----------------

  const clearForm = () => {

    setCompany("")
    setRole("")
    setStatus("Applied")
    setApplicationDate("")
    setEditingId(null)

  }


  // ---------------- LOGOUT ----------------

  const logout = () => {

    localStorage.removeItem("token")
    localStorage.removeItem("username")

    setToken(null)

  }


  // ---------------- DASHBOARD STATS ----------------

  const totalInternships = internships.length

  const appliedCount = internships.filter(
    internship => internship.status === "Applied"
  ).length

  const interviewCount = internships.filter(
    internship => internship.status === "Interview"
  ).length

  const selectedCount = internships.filter(
    internship => internship.status === "Selected"
  ).length

  const rejectedCount = internships.filter(
    internship => internship.status === "Rejected"
  ).length

  const selectionRate =
    totalInternships === 0
      ? 0
      : ((selectedCount / totalInternships) * 100).toFixed(1)


  // ---------------- SEARCH + FILTER ----------------

  const filteredInternships = internships.filter(
    internship => {

      const matchesSearch =
        internship.company
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        internship.role
          .toLowerCase()
          .includes(search.toLowerCase())

      const matchesStatus =
        filterStatus === "All" ||
        internship.status === filterStatus

      return matchesSearch && matchesStatus

    }
  )


  // ==================================================
  // LOGIN / SIGNUP SCREEN
  // ==================================================

  if (!token) {

    return (
      <div className="auth-container">

        <div className="auth-card">

          <h1>Internship Tracker</h1>

          <h2>
            {isLogin ? "Login" : "Create Account"}
          </h2>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button onClick={handleSubmit}>
            {isLogin ? "Login" : "Sign Up"}
          </button>

          <p
            className="switch-auth"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Login"}
          </p>

        </div>

      </div>
    )
  }


  // ==================================================
  // INTERNSHIP DASHBOARD
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

          <button
            className="logout"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>


      {/* Dashboard */}

      <section className="dashboard">

        <div className="stat-card">
          <h3>Total</h3>
          <p>{totalInternships}</p>
        </div>

        <div className="stat-card">
          <h3>Applied</h3>
          <p>{appliedCount}</p>
        </div>

        <div className="stat-card">
          <h3>Interview</h3>
          <p>{interviewCount}</p>
        </div>

        <div className="stat-card">
          <h3>Selected</h3>
          <p>{selectedCount}</p>
        </div>

        <div className="stat-card">
          <h3>Rejected</h3>
          <p>{rejectedCount}</p>
        </div>

        <div className="stat-card">
          <h3>Selection Rate</h3>
          <p>{selectionRate}%</p>
        </div>

      </section>


      {/* Form */}

      <section className="form-section">

        <h2>
          {editingId
            ? "Edit Internship"
            : "Add Internship"}
        </h2>

        <div className="form">

          <input
            type="text"
            placeholder="Company"
            value={company}
            onChange={e => setCompany(e.target.value)}
          />

          <input
            type="text"
            placeholder="Role"
            value={role}
            onChange={e => setRole(e.target.value)}
          />

          <input
            type="date"
            value={applicationDate}
            onChange={e =>
              setApplicationDate(e.target.value)
            }
          />

          <select
            value={status}
            onChange={e =>
              setStatus(e.target.value)
            }
          >

            <option>Applied</option>
            <option>Interview</option>
            <option>Rejected</option>
            <option>Selected</option>

          </select>


          {editingId ? (

            <>
              <button onClick={updateInternship}>
                Update
              </button>

              <button
                className="cancel"
                onClick={clearForm}
              >
                Cancel
              </button>
            </>

          ) : (

            <button onClick={addInternship}>
              Add Internship
            </button>

          )}

        </div>

      </section>


      {/* Internship List */}

      <section className="internships-section">

        <h2>My Internships</h2>


        <div className="filters">

          <input
            type="text"
            placeholder="Search company or role..."
            value={search}
            onChange={e =>
              setSearch(e.target.value)
            }
          />

          <select
            value={filterStatus}
            onChange={e =>
              setFilterStatus(e.target.value)
            }
          >

            <option value="All">
              All Statuses
            </option>

            <option value="Applied">
              Applied
            </option>

            <option value="Interview">
              Interview
            </option>

            <option value="Rejected">
              Rejected
            </option>

            <option value="Selected">
              Selected
            </option>

          </select>

        </div>


        <div className="internship-list">

          {filteredInternships.map(
            internship => (

              <div
                className="internship-card"
                key={internship.id}
              >

                <div>

                  <h3>
                    {internship.company}
                  </h3>

                  <p>
                    {internship.role}
                  </p>

                  <span className="status">
                    {internship.status}
                  </span>

                  <p className="application-date">

                    Applied on:{" "}

                    {new Date(
                      internship.application_date
                    ).toLocaleDateString("en-GB")}

                  </p>

                </div>


                <div className="actions">

                  <button
                    className="edit"
                    onClick={() =>
                      editInternship(internship)
                    }
                  >
                    Edit
                  </button>

                  <button
                    className="delete"
                    onClick={() =>
                      deleteInternship(internship.id)
                    }
                  >
                    Delete
                  </button>

                </div>

              </div>

            )
          )}

        </div>

      </section>

    </div>
  )
}

export default App