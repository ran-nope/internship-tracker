import { useEffect } from 'react'
import {
  CheckCircle2,
  X,
  AlertCircle,
  Inbox,
  SearchX,
  Plus,
} from 'lucide-react'

export function Toast({ message, dismiss }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(dismiss, 6000)
    return () => clearTimeout(timer)
  }, [message, dismiss])
  if (!message) return null
  return (
    <div className="toast" role="status">
      <CheckCircle2 size={20} />
      <span>{message}</span>
      <button
        className="icon-button"
        onClick={dismiss}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function ErrorMessage({ message, retry, dismiss }) {
  if (!message) return null
  return (
    <div className="message error" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Retry
        </button>
      )}
      {dismiss && (
        <button
          className="icon-button"
          onClick={dismiss}
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export function Skeleton({ charts = false }) {
  return (
    <div
      className={charts ? 'charts-grid skeleton-charts' : 'loading-state'}
      role="status"
      aria-label={charts ? 'Loading analytics' : 'Loading internships...'}
    >
      <span className="sr-only">
        {charts ? 'Loading analytics' : 'Loading internships...'}
      </span>
      {Array.from({ length: charts ? 2 : 4 }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton skeleton-avatar" />
          <div>
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
          </div>
          <span className="skeleton skeleton-badge" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ filtered, onReset, onAdd }) {
  const Icon = filtered ? SearchX : Inbox
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={27} />
      </div>
      <h3>
        {filtered
          ? 'No matching applications'
          : 'Your next opportunity starts here'}
      </h3>
      <p>
        {filtered
          ? 'Try a different search or clear your filters to see all applications.'
          : 'Add your first application. Keep every opportunity, update, and next step in one place.'}
      </p>
      <button
        className={filtered ? 'secondary-button' : 'primary-button'}
        onClick={filtered ? onReset : onAdd}
      >
        {!filtered && <Plus size={17} />}
        {filtered ? 'Reset filters' : 'Add your first application'}
      </button>
    </div>
  )
}
