import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarCheck,
  Gift,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { useTracker } from './hooks/useTracker'
import { useTheme } from './hooks/useTheme'
import { useNavigation } from './hooks/useNavigation'
import { PROTECTED_ROUTES, routeHref } from './utils/navigation'
import LandingPage from './components/LandingPage'
import { summarizeApplications, filterApplications } from './utils/applications'
import AppShell from './components/AppShell'
import AuthPage from './components/AuthPage'
import ApplicationForm from './components/ApplicationForm'
import ApplicationList from './components/ApplicationList'
import ChartBoundary from './components/ChartBoundary'
import { ErrorMessage, Skeleton, Toast } from './components/Feedback'
import './App.css'
import './styles/product.css'

const AnalyticsCharts = lazy(() => import('./components/AnalyticsCharts'))
const INITIAL_FILTERS = { search: '', status: 'All', sort: 'newest' }

function Workspace({ tracker, theme, toggleTheme, page, onNavigate }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [formOpen, setFormOpen] = useState(false)
  const summary = useMemo(
    () => summarizeApplications(tracker.internships),
    [tracker.internships],
  )
  const filtered = useMemo(
    () => filterApplications(tracker.internships, filters),
    [tracker.internships, filters],
  )
  const { setSuccess } = tracker
  const dismissSuccess = useCallback(() => setSuccess(''), [setSuccess])
  const username =
    localStorage.getItem('username') || tracker.username || 'Your account'
  const add = () => {
    if (tracker.busy || tracker.loading || tracker.loadFailed) return
    tracker.clearForm()
    tracker.setError('')
    setFormOpen(true)
  }
  const edit = (item) => {
    tracker.editInternship(item)
    setFormOpen(true)
  }
  const close = () => {
    if (tracker.busy) return
    setFormOpen(false)
    tracker.clearForm()
  }
  const onStatus = (status) => {
    setFilters({ ...INITIAL_FILTERS, status })
    onNavigate('applications')
  }
  return (
    <AppShell
      page={page}
      onNavigate={onNavigate}
      onAdd={add}
      disabled={tracker.loading || tracker.busy || tracker.loadFailed}
      username={username}
      logout={() => {
        tracker.logout()
        onNavigate('login', { replace: true })
      }}
      theme={theme}
      toggleTheme={toggleTheme}
    >
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="heading-dot" /> YOUR SEARCH / IN PERSPECTIVE
          </div>
          <h1>
            {page === 'overview'
              ? 'Your search. In perspective.'
              : 'Every opportunity, considered.'}
          </h1>
          <p>
            {page === 'overview'
              ? 'Keep your search moving. Make your next step a little clearer.'
              : 'From first application to final offer. You’ve got this.'}
          </p>
        </div>
        <button
          className="primary-button"
          onClick={add}
          disabled={tracker.loading || tracker.busy || tracker.loadFailed}
        >
          <Plus size={17} />
          New application
        </button>
      </div>
      <ErrorMessage
        message={!formOpen ? tracker.error : ''}
        retry={tracker.loadFailed ? tracker.retry : undefined}
        dismiss={!tracker.loadFailed ? () => tracker.setError('') : undefined}
      />
      {page === 'overview' && (
        <>
          <div className="section-overline">
            <span>AT A GLANCE</span>
            <span>All your applications · All time</span>
          </div>
          <section className="metrics-grid" aria-label="Application statistics">
            {[
              [
                'Total applications',
                summary.total,
                `${summary.active} active applications`,
                BriefcaseBusiness,
                'blue',
                'total',
              ],
              [
                'Interviews',
                summary.counts.Interview,
                'Currently at the interview stage',
                CalendarCheck,
                'amber',
                'interviews',
              ],
              [
                'Offers',
                summary.counts.Offer,
                'Currently at the offer stage',
                Gift,
                'green',
                'offers',
              ],
              [
                'Selection rate',
                `${summary.selectionRate}%`,
                `${summary.counts.Selected} selected of ${summary.total} applications`,
                TrendingUp,
                'purple',
                'selection-rate',
              ],
            ].map(([label, value, note, Icon, color, id]) => (
              <div className="metric-card" key={label}>
                <div className="metric-top">
                  <h2>{label}</h2>
                  <span className={`metric-icon ${color}`}>
                    <Icon size={17} />
                  </span>
                </div>
                {tracker.loading ? (
                  <span className="skeleton metric-skeleton" />
                ) : (
                  <strong className="metric-value" data-testid={`metric-${id}`}>
                    {tracker.loadFailed ? '—' : value}
                  </strong>
                )}
                <p>
                  {tracker.loading || tracker.loadFailed
                    ? 'Waiting for your applications'
                    : note}
                </p>
              </div>
            ))}
          </section>
          {tracker.loading ? (
            <Skeleton charts />
          ) : (
            !tracker.loadFailed && (
              <ChartBoundary onApplications={() => onNavigate('applications')}>
                <Suspense fallback={<Skeleton charts />}>
                  <AnalyticsCharts
                    items={tracker.internships}
                    summary={summary}
                    onStatus={onStatus}
                  />
                </Suspense>
              </ChartBoundary>
            )
          )}
          <div className="activity-heading">
            <div>
              <span className="eyebrow">MAKE YOUR NEXT MOVE</span>
              <h2>Your search, in motion.</h2>
            </div>
            <span className="activity-note">
              <ArrowUpRight size={15} />
              Every application is a step forward.
            </span>
          </div>
        </>
      )}
      <ApplicationList
        items={filtered}
        total={tracker.internships.length}
        tracker={tracker}
        filters={filters}
        setFilters={setFilters}
        resetFilters={() => setFilters(INITIAL_FILTERS)}
        onAdd={add}
        onEdit={edit}
      />
      {formOpen && <ApplicationForm tracker={tracker} close={close} />}
      <Toast message={tracker.success} dismiss={dismissSuccess} />
    </AppShell>
  )
}

export default function App() {
  const { route, next, section, location, navigate } = useNavigation()
  const protectedRoute = PROTECTED_ROUTES.includes(route)
  const tracker = useTracker({ workspaceActive: protectedRoute })
  const { theme, toggleTheme } = useTheme()
  const token = tracker.token
  const authRoute = route === 'login' || route === 'signup'

  useEffect(() => {
    if (protectedRoute && !token)
      navigate('login', { next: route, replace: true })
    else if (authRoute && token) navigate(next, { replace: true })
  }, [route, next, protectedRoute, authRoute, token, navigate])

  useEffect(() => {
    const titles = {
      home: 'A considered workspace for your next chapter',
      login: 'Log in',
      signup: 'Create your workspace',
      overview: 'Overview',
      applications: 'Applications',
    }
    document.title = `${titles[route] || 'Page not found'} · Internship Tracker`
    if (section) {
      const destination = document.getElementById(section)
      destination?.focus({ preventScroll: true })
      destination?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
      document.querySelector('main')?.focus({ preventScroll: true })
    }
  }, [location, route, section])

  if ((protectedRoute && !token) || (authRoute && token)) {
    return (
      <main className="route-loading" role="status">
        Opening your workspace…
      </main>
    )
  }
  if (protectedRoute) {
    return (
      <Workspace
        key={token}
        tracker={tracker}
        theme={theme}
        toggleTheme={toggleTheme}
        page={route}
        onNavigate={navigate}
      />
    )
  }
  if (authRoute) {
    return (
      <AuthPage
        key={route}
        tracker={tracker}
        theme={theme}
        toggleTheme={toggleTheme}
        mode={route}
        next={next}
        navigate={navigate}
      />
    )
  }
  if (route === 'home')
    return (
      <LandingPage
        theme={theme}
        toggleTheme={toggleTheme}
        authenticated={!!token}
      />
    )
  return (
    <main className="not-found" tabIndex={-1}>
      <span className="section-index">404 / A SMALL DETOUR</span>
      <h1>This page took a different path.</h1>
      <p>Your next chapter is still within reach.</p>
      <a className="primary-button" href={routeHref('home')}>
        Back to home
        <ArrowUpRight size={17} />
      </a>
    </main>
  )
}
