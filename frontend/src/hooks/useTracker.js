import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import { EMPTY_FORM } from '../utils/applications'

export function useTracker({ workspaceActive = true } = {}) {
  const [token, setToken] = useState(localStorage.getItem('token'))

  const sessionVersion = useRef(0)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [internships, setInternships] = useState([])
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editingId, setEditingId] = useState(null)

  const [requestLoading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const loading = requestLoading || !!(token && !hasLoaded)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const mutationLock = useRef(false)

  // ---------------- LOAD INTERNSHIPS ----------------

  useEffect(() => {
    if (!token || !workspaceActive) return

    let cancelled = false
    const controller = new AbortController()

    async function loadInternships() {
      setLoading(true)
      setLoadFailed(false)
      setError('')

      try {
        const data = await apiRequest(
          '/internships',
          { signal: controller.signal },
          token,
        )

        if (!cancelled) {
          setInternships(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setLoadFailed(true)
        }
      } finally {
        if (!cancelled) {
          setHasLoaded(true)
          setLoading(false)
        }
      }
    }

    loadInternships()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [token, loadVersion, workspaceActive])

  // ---------------- LOGIN / SIGNUP ----------------

  async function handleSubmit(event, mode = 'login') {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }

    setLoading(true)

    try {
      const endpoint = mode === 'login' ? '/login' : '/signup'

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })

      if (mode === 'login') {
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('username', data.username)

        setToken(data.access_token)
        setPassword('')
        setSuccess('Login successful!')
      } else {
        setSuccess('Account created! You can now log in.')
        setPassword('')
      }
      return mode
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
    if (loading || loadFailed || mutationLock.current) return

    setError('')
    setSuccess('')

    if (!form.company.trim() || !form.role.trim() || !form.application_date) {
      setError('Company, role, and application date are required.')
      return
    }

    if (form.job_url.trim() && !/^https?:\/\/\S+/i.test(form.job_url.trim())) {
      setError('Job URL must start with http:// or https://')
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
    mutationLock.current = true
    setSaving(true)

    try {
      if (editingId !== null) {
        const updated = await apiRequest(
          `/internships/${editingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
          token,
        )

        if (sessionVersion.current !== requestSession) return

        setInternships((previous) =>
          previous.map((item) => (item.id === editingId ? updated : item)),
        )

        setSuccess('Internship updated successfully!')
      } else {
        const created = await apiRequest(
          '/internships',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
          token,
        )

        if (sessionVersion.current !== requestSession) return

        setInternships((previous) => [created, ...previous])

        setSuccess('Internship added successfully!')
      }

      clearForm()
      return true
    } catch (err) {
      if (sessionVersion.current === requestSession) setError(err.message)
    } finally {
      if (sessionVersion.current === requestSession) {
        mutationLock.current = false
        setSaving(false)
      }
    }
  }

  // ---------------- EDIT ----------------

  function editInternship(internship) {
    setForm({
      company: internship.company || '',
      role: internship.role || '',
      status: internship.status || 'Applied',
      application_date: internship.application_date || '',
      location: internship.location || '',
      job_url: internship.job_url || '',
      notes: internship.notes || '',
    })

    setEditingId(internship.id)
    setError('')
    setSuccess('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  // ---------------- DELETE ----------------

  async function deleteInternship(id) {
    if (mutationLock.current) return
    if (!window.confirm('Delete this internship permanently?')) {
      return
    }

    setError('')
    setSuccess('')

    const requestSession = sessionVersion.current
    mutationLock.current = true
    setDeletingId(id)
    try {
      await apiRequest(`/internships/${id}`, { method: 'DELETE' }, token)

      if (sessionVersion.current !== requestSession) return

      setInternships((previous) => previous.filter((item) => item.id !== id))

      if (editingId === id) {
        clearForm()
      }

      setSuccess('Internship deleted successfully!')
    } catch (err) {
      if (sessionVersion.current === requestSession) setError(err.message)
    } finally {
      if (sessionVersion.current === requestSession) {
        mutationLock.current = false
        setDeletingId(null)
      }
    }
  }

  // ---------------- LOGOUT ----------------

  function logout() {
    sessionVersion.current += 1
    mutationLock.current = false
    setLoadFailed(false)
    setHasLoaded(false)
    setLoading(false)
    setSaving(false)
    setDeletingId(null)
    localStorage.removeItem('token')
    localStorage.removeItem('username')

    setToken(null)
    setInternships([])
    clearForm()
    setError('')
    setSuccess('')
  }

  return {
    token,
    username,
    setUsername,
    password,
    setPassword,
    internships,
    form,
    editingId,
    loading,
    saving,
    deletingId,
    error,
    success,
    loadFailed,
    setError,
    setSuccess,
    handleSubmit,
    updateField,
    clearForm,
    saveInternship,
    editInternship,
    deleteInternship,
    logout,
    retry: () => setLoadVersion((version) => version + 1),
    busy: saving || deletingId !== null,
  }
}
