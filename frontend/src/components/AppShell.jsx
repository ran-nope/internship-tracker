import { useEffect, useRef, useState } from 'react'
import Brand from './Brand'
import {
  LayoutDashboard,
  BriefcaseBusiness,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  Plus,
} from 'lucide-react'

export default function AppShell({
  children,
  page,
  onNavigate,
  onAdd,
  disabled,
  username,
  logout,
  theme,
  toggleTheme,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebar = useRef(null)
  const menuButton = useRef(null)
  useEffect(() => {
    if (!mobileOpen) return
    const trigger = menuButton.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () =>
      [...sidebar.current.querySelectorAll('button, a[href]')].filter(
        (item) => !item.disabled && item.getClientRects().length,
      )
    controls()[0]?.focus()
    function handleKey(event) {
      if (event.key === 'Escape') setMobileOpen(false)
      if (event.key !== 'Tab') return
      const elements = controls()
      const first = elements[0],
        last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      trigger?.focus()
    }
  }, [mobileOpen])
  const navigate = (destination) => {
    onNavigate(destination)
    setMobileOpen(false)
  }
  return (
    <div className={`workspace ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Skip to content
      </a>
      {mobileOpen && (
        <div
          className="nav-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        id="workspace-sidebar"
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? 'true' : undefined}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <Brand className="sidebar-product-brand" />
          <button
            className="icon-button mobile-close"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-label sidebar-label">PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            ['overview', LayoutDashboard, 'Overview'],
            ['applications', BriefcaseBusiness, 'Applications'],
          ].map(([value, Icon, label]) => (
            <button
              key={value}
              className={`nav-item ${page === value ? 'active' : ''}`}
              onClick={() => navigate(value)}
              aria-current={page === value ? 'page' : undefined}
              aria-label={label}
              title={collapsed ? label : undefined}
            >
              <Icon size={19} />
              <span className="sidebar-label">{label}</span>
              {page === value && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <button
          className="sidebar-add sidebar-label"
          onClick={() => {
            setMobileOpen(false)
            onAdd()
          }}
          disabled={disabled}
        >
          <Plus size={17} />
          New application
        </button>
        <div className="sidebar-spacer" />
        <div className="sidebar-note sidebar-label">
          <span className="note-dot" />
          <strong>A little progress, every day.</strong>
          <p>Your next opportunity is worth keeping track of.</p>
        </div>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title="Toggle appearance"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span className="sidebar-label">
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </span>
          </button>
          <button
            className="nav-item collapse-control"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span className="sidebar-label">Collapse sidebar</span>
          </button>
          <div className="account-block">
            <span className="avatar">{username.slice(0, 2).toUpperCase()}</span>
            <div className="sidebar-label account-name">
              <strong title={username}>{username}</strong>
              <span>Personal account</span>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main" inert={mobileOpen}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              ref={menuButton}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="workspace-sidebar"
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page === 'overview' ? 'Overview' : 'Applications'}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-indicator">
              <span />
              Personal workspace
            </span>
            <span className="avatar small-avatar" aria-hidden="true">
              {username.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Internship Tracker</span>
          <span>A clearer path to what’s next.</span>
        </footer>
      </div>
    </div>
  )
}
