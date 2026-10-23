import { useState } from 'react'
import {
  Search,
  RotateCcw,
  LayoutGrid,
  List,
  MapPin,
  ExternalLink,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BriefcaseBusiness,
} from 'lucide-react'
import { STATUSES, formatDate } from '../utils/applications'
import { EmptyState, Skeleton } from './Feedback'

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <i />
      {status}
    </span>
  )
}
function CompanyMark({ company }) {
  return (
    <span className="company-mark" aria-hidden="true">
      {company.slice(0, 1).toUpperCase()}
    </span>
  )
}
function SafeLink({ value }) {
  if (!/^https?:\/\//i.test(value || '')) return null
  return (
    <a
      className="application-link"
      href={value}
      target="_blank"
      rel="noopener noreferrer"
    >
      View application
      <ExternalLink size={12} />
    </a>
  )
}
function Actions({ item, tracker, onEdit }) {
  return (
    <div className="record-actions">
      <button
        className="icon-button"
        title="Edit"
        aria-label="Edit"
        disabled={tracker.busy}
        onClick={() => onEdit(item)}
      >
        <Pencil size={15} />
      </button>
      <button
        className="icon-button danger-button"
        title="Delete"
        aria-label={tracker.deletingId === item.id ? 'Deleting...' : 'Delete'}
        disabled={tracker.busy}
        onClick={() => tracker.deleteInternship(item.id)}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

export default function ApplicationList({
  items,
  total,
  tracker,
  filters,
  setFilters,
  resetFilters,
  onAdd,
  onEdit,
}) {
  const [view, setView] = useState(() =>
    localStorage.getItem('application-view') === 'cards' ? 'cards' : 'table',
  )
  const [page, setPage] = useState(0)
  const pageSize = 8
  // Derive the page from the result set, so deleting a final row never strands it.
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(items.length / pageSize) - 1),
  )
  const visible = items.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  )
  const filtered = !!filters.search.trim() || filters.status !== 'All'
  const changed = filtered || filters.sort !== 'newest'
  const changeFilter = (name, value) => {
    setFilters((previous) => ({ ...previous, [name]: value }))
    setPage(0)
  }
  const chooseView = (value) => {
    setView(value)
    localStorage.setItem('application-view', value)
  }
  return (
    <section
      className="panel applications-panel"
      aria-labelledby="applications-heading"
    >
      <div className="panel-heading applications-heading">
        <div className="title-with-count">
          <h2 id="applications-heading">Your applications</h2>
          <span className="count-badge">
            {tracker.loading || tracker.loadFailed ? '—' : total}
          </span>
        </div>
        <div className="view-toggle" aria-label="Application display">
          <button
            className={view === 'table' ? 'selected' : ''}
            aria-label="Table view"
            aria-pressed={view === 'table'}
            onClick={() => chooseView('table')}
          >
            <List size={17} />
          </button>
          <button
            className={view === 'cards' ? 'selected' : ''}
            aria-label="Card view"
            aria-pressed={view === 'cards'}
            onClick={() => chooseView('cards')}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>
      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">Search applications</span>
          <input
            type="search"
            placeholder="Search company, role, or location..."
            value={filters.search}
            onChange={(event) => changeFilter('search', event.target.value)}
          />
        </label>
        <div className="filter-selects">
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(event) => changeFilter('status', event.target.value)}
            >
              <option value="All">All Statuses</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort applications</span>
            <select
              aria-label="Sort applications"
              value={filters.sort}
              onChange={(event) => changeFilter('sort', event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="company">Company A–Z</option>
            </select>
          </label>
          <button
            className="secondary-button reset-button"
            onClick={() => {
              resetFilters()
              setPage(0)
            }}
            disabled={!changed}
            aria-label="Reset filters"
            title="Reset filters"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>
      </div>
      {tracker.loading ? (
        <Skeleton />
      ) : tracker.loadFailed ? (
        <div className="empty-state">
          <BriefcaseBusiness size={27} />
          <h3>We couldn’t load your applications</h3>
          <p>Your data hasn’t changed. Check your connection and try again.</p>
          <button className="secondary-button" onClick={tracker.retry}>
            Retry loading
          </button>
        </div>
      ) : !items.length ? (
        <EmptyState filtered={filtered} onReset={resetFilters} onAdd={onAdd} />
      ) : (
        <>
          <div className={`records-container view-${view}`}>
            <div className="table-scroll">
              <table className="applications-table">
                <caption className="sr-only">
                  Your internship applications, sorted by {filters.sort}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Company & role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Location</th>
                    <th scope="col">Applied on</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id} data-testid="application-row">
                      <td>
                        <div className="company-cell">
                          <CompanyMark company={item.company} />
                          <div>
                            <strong>{item.company}</strong>
                            <span>{item.role}</span>
                            <details className="row-details">
                              <summary>View details</summary>
                              <div>
                                <p>
                                  <strong>Role:</strong> {item.role}
                                </p>
                                <p>
                                  <strong>Location:</strong>{' '}
                                  {item.location || 'Not specified'}
                                </p>
                                {item.job_url && (
                                  <SafeLink value={item.job_url} />
                                )}
                                {item.notes && (
                                  <p className="notes">
                                    <strong>Notes:</strong> {item.notes}
                                  </p>
                                )}
                                {!item.notes && !item.job_url && (
                                  <p>No additional notes or links.</p>
                                )}
                              </div>
                            </details>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <span className="location-text">
                          {item.location || 'Not specified'}
                        </span>
                      </td>
                      <td className="date-cell">
                        {formatDate(item.application_date)}
                      </td>
                      <td>
                        <Actions
                          item={item}
                          tracker={tracker}
                          onEdit={onEdit}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="application-cards">
              {visible.map((item) => (
                <article className="application-card" key={item.id}>
                  <div className="card-top">
                    <CompanyMark company={item.company} />
                    <StatusBadge status={item.status} />
                  </div>
                  <h3>{item.company}</h3>
                  <p className="card-role">{item.role}</p>
                  <div className="card-meta">
                    <span>
                      <MapPin size={14} />
                      {item.location || 'Location not specified'}
                    </span>
                    <span>Applied {formatDate(item.application_date)}</span>
                  </div>
                  {item.job_url && <SafeLink value={item.job_url} />}
                  {item.notes && (
                    <details className="card-notes">
                      <summary>Notes</summary>
                      <p className="notes">{item.notes}</p>
                    </details>
                  )}
                  <div className="card-footer">
                    <span>Application details</span>
                    <Actions item={item} tracker={tracker} onEdit={onEdit} />
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="list-footer">
            <span>
              Showing {currentPage * pageSize + 1}–
              {Math.min((currentPage + 1) * pageSize, items.length)} of{' '}
              {items.length} {filtered ? 'matching ' : ''}applications
            </span>
            <div className="pagination">
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {currentPage + 1} of {Math.ceil(items.length / pageSize)}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={(currentPage + 1) * pageSize >= items.length}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
