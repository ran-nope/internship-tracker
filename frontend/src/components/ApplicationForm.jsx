import { useEffect, useRef } from 'react'
import { X, ArrowUpRight } from 'lucide-react'
import { STATUSES } from '../utils/applications'
import { ErrorMessage } from './Feedback'

export default function ApplicationForm({ tracker, close }) {
  const dialog = useRef(null)
  const {
    form,
    editingId,
    updateField,
    saving,
    busy,
    loading,
    loadFailed,
    error,
    saveInternship,
  } = tracker
  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    element.showModal()
    element.querySelector('[name="company"]')?.focus()
    return () => {
      element.close()
      requestAnimationFrame(() => {
        if (opener?.isConnected && opener.getClientRects().length)
          opener.focus()
        else
          document
            .querySelector('#main-content .page-heading .primary-button')
            ?.focus()
      })
    }
  }, [])
  async function submit(event) {
    if (await saveInternship(event)) close()
  }
  return (
    <dialog
      className="application-dialog"
      ref={dialog}
      aria-labelledby="form-heading"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) close()
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">KEEP YOUR NEXT STEP IN SIGHT</span>
          <h2 id="form-heading">
            {editingId !== null ? 'Edit Internship' : 'Add Internship'}
          </h2>
          <p>The details today. A little more clarity tomorrow.</p>
        </div>
        <button
          className="icon-button"
          onClick={close}
          disabled={busy}
          aria-label="Close application form"
        >
          <X size={20} />
        </button>
      </div>
      <ErrorMessage message={error} />
      <form onSubmit={submit} className="application-form">
        <fieldset disabled={loading || busy || loadFailed}>
          <div className="form-grid">
            <label>
              Company <span className="required">*</span>
              <input
                name="company"
                placeholder="Company *"
                value={form.company}
                onChange={updateField}
                maxLength={200}
                required
              />
            </label>
            <label>
              Role <span className="required">*</span>
              <input
                name="role"
                placeholder="Role *"
                value={form.role}
                onChange={updateField}
                maxLength={200}
                required
              />
            </label>
            <label>
              Application date <span className="required">*</span>
              <input
                name="application_date"
                type="date"
                value={form.application_date}
                onChange={updateField}
                required
              />
            </label>
            <label>
              Status
              <select name="status" value={form.status} onChange={updateField}>
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Location
              <input
                name="location"
                placeholder="Location (e.g. Bengaluru)"
                value={form.location}
                onChange={updateField}
              />
            </label>
            <label>
              Application link
              <input
                name="job_url"
                type="url"
                placeholder="Job application URL"
                value={form.job_url}
                onChange={updateField}
              />
            </label>
            <label className="full-width">
              Notes
              <textarea
                name="notes"
                placeholder="Notes (skills, deadlines, contacts...)"
                value={form.notes}
                onChange={updateField}
                rows={4}
              />
            </label>
          </div>
          <div className="dialog-actions">
            <span>* Required fields</span>
            <button className="secondary-button" type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {saving
                ? 'Saving...'
                : editingId !== null
                  ? 'Update Internship'
                  : 'Add Internship'}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  )
}
