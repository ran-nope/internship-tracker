import {
  ArrowUpRight,
  ArrowRight,
  Moon,
  Sun,
  Layers3,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Check,
  MoveUpRight,
} from 'lucide-react'
import Brand from './Brand'
import DashboardPreview from './DashboardPreview'
import { routeHref } from '../utils/navigation'

export default function LandingPage({ theme, toggleTheme, authenticated }) {
  const startHref = routeHref(authenticated ? 'overview' : 'signup')
  return (
    <div className="public-site">
      <a
        className="skip-link"
        href="#public-main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('public-main')?.focus()
        }}
      >
        Skip to content
      </a>
      <header className="public-header">
        <div className="public-container public-nav">
          <Brand />
          <nav className="public-section-nav" aria-label="Product navigation">
            <a href={routeHref('home', { section: 'workspace' })}>
              The workspace
            </a>
            <a href={routeHref('home', { section: 'features' })}>Features</a>
            <a href={routeHref('home', { section: 'approach' })}>
              The approach
            </a>
          </nav>
          <div className="public-nav-actions">
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {authenticated ? (
              <a className="public-login" href={routeHref('overview')}>
                Open workspace
                <ArrowUpRight size={14} />
              </a>
            ) : (
              <>
                <a className="public-login" href={routeHref('login')}>
                  Log in
                </a>
                <a
                  className="primary-button public-nav-signup"
                  href={startHref}
                >
                  Sign up
                  <ArrowUpRight size={14} />
                </a>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="public-main" tabIndex={-1}>
        <section
          className="public-container landing-hero"
          aria-labelledby="hero-title"
        >
          <div className="hero-kicker">
            <span className="identity-grid" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            A CONSIDERED APPROACH TO YOUR NEXT CHAPTER
          </div>
          <div className="hero-grid">
            <div className="hero-title-block">
              <h1 id="hero-title">
                Ambition,
                <br />
                <span>well organized.</span>
              </h1>
              <div className="hero-actions">
                <a className="primary-button hero-primary" href={startHref}>
                  {authenticated
                    ? 'Return to your workspace'
                    : 'Create your workspace'}
                  <ArrowUpRight size={19} />
                </a>
                <a
                  className="hero-secondary"
                  href={routeHref('home', { section: 'workspace' })}
                >
                  Take a closer look
                  <ArrowRight size={17} />
                </a>
              </div>
              <p className="hero-footnote">
                <span />A focused workspace for a search that’s entirely yours.
              </p>
            </div>
            <div className="hero-aside">
              <span className="section-index">01 / THE IDEA</span>
              <p>
                Your search has enough moving parts.
                <br />
                <strong>Give it a little clarity.</strong>
              </p>
              <p className="hero-description">
                A thoughtful home for your internship applications. Keep the
                details together, understand your progress, and make your next
                move with intention.
              </p>
              <div className="hero-benefits">
                <span>
                  <Check size={14} />
                  Every application, in one place
                </span>
                <span>
                  <Check size={14} />
                  Your progress, at a glance
                </span>
                <span>
                  <Check size={14} />
                  Less friction. More focus.
                </span>
              </div>
            </div>
          </div>
          <div className="hero-bottom-line">
            <span>BUILT FOR THE SEARCH. DESIGNED FOR YOU.</span>
            <span className="hero-coordinate">
              CLARITY → MOMENTUM → OPPORTUNITY
            </span>
          </div>
        </section>
        <section
          className="preview-section"
          id="workspace"
          aria-labelledby="workspace-preview-title"
          tabIndex={-1}
        >
          <div className="public-container">
            <h2 className="sr-only" id="workspace-preview-title">
              Explore the workspace
            </h2>
            <div className="preview-section-heading">
              <span className="section-index">02 / A VIEW OF WHAT’S NEXT</span>
              <span>
                One workspace. A little more perspective.
                <MoveUpRight size={16} />
              </span>
            </div>
            <DashboardPreview />
          </div>
        </section>
        <section
          className="public-container features-section"
          id="features"
          tabIndex={-1}
          aria-labelledby="features-title"
        >
          <div className="section-intro">
            <div>
              <span className="section-index">
                03 / LESS NOISE. MORE SIGNAL.
              </span>
              <h2 id="features-title">
                Everything you need.
                <br />
                <span>Room to breathe.</span>
              </h2>
            </div>
            <p>
              Purposeful tools for the everyday work of finding your next
              opportunity. Nothing to get in your way.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                '01',
                Layers3,
                'A home for every application.',
                'Keep companies, roles, links, dates, and notes together. Your search, thoughtfully organized from the start.',
                'Collect with clarity',
              ],
              [
                '02',
                ChartNoAxesCombined,
                'Progress you can see.',
                'Understand your application activity and current pipeline. A clear perspective on where things stand.',
                'See the bigger picture',
              ],
              [
                '03',
                SlidersHorizontal,
                'A little less friction.',
                'Find the right application, filter by status, and focus on what matters. On your desk or on the move.',
                'Move with intention',
              ],
            ].map(([number, Icon, title, description, note]) => (
              <div className="feature-card" key={number}>
                <div className="feature-card-top">
                  <span>{number}</span>
                  <Icon size={23} strokeWidth={1.5} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <a
                  className="feature-note"
                  href={routeHref(
                    authenticated
                      ? number === '02'
                        ? 'overview'
                        : 'applications'
                      : 'signup',
                  )}
                >
                  {note}
                  <ArrowUpRight size={14} />
                </a>
              </div>
            ))}
          </div>
        </section>
        <section
          className="approach-section"
          id="approach"
          tabIndex={-1}
          aria-labelledby="approach-title"
        >
          <div className="public-container approach-grid">
            <div>
              <span className="section-index">04 / A SIMPLE RHYTHM</span>
              <h2 id="approach-title">
                A calmer way
                <br />
                <span>forward.</span>
              </h2>
              <p>
                A search is a series of small steps.
                <br />
                Make each one easier to keep track of.
              </p>
              <span className="approach-glyph" aria-hidden="true">
                <ArrowUpRight size={80} strokeWidth={1} />
              </span>
            </div>
            <ol className="approach-steps">
              {[
                [
                  'Capture the opportunity.',
                  'Add a role you’ve applied for. Save the details you’ll want to come back to.',
                ],
                [
                  'Keep the story current.',
                  'Update a status, add a note, and keep your next conversation in context.',
                ],
                [
                  'Find your perspective.',
                  'See your activity, explore your pipeline, and decide where to put your attention next.',
                ],
              ].map(([title, description], index) => (
                <li key={title}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="public-container landing-final">
          <div className="final-cta">
            <div>
              <span className="section-index">
                YOUR NEXT CHAPTER IS WORTH THE ATTENTION.
              </span>
              <h2>
                Make space for
                <br />
                what comes next<span>.</span>
              </h2>
            </div>
            <div>
              <p>
                Bring a little intention to your internship search.
                <br />
                Start with a workspace of your own.
              </p>
              <a className="primary-button" href={startHref}>
                {authenticated
                  ? 'Open your workspace'
                  : 'Create your workspace'}
                <ArrowUpRight size={18} />
              </a>
              <span className="cta-account-note">
                {authenticated ? (
                  'Your applications are right where you left them.'
                ) : (
                  <>
                    Already have an account?{' '}
                    <a href={routeHref('login')}>Log in</a>
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="privacy-note">
            <span className="identity-grid" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <p>
              <strong>Your search. Your workspace.</strong> Applications are
              tied to your account and kept separate from other users.
            </p>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="public-container">
          <Brand />
          <span>© {new Date().getFullYear()} Internship Tracker</span>
          <span>Designed for your next chapter.</span>
        </div>
      </footer>
    </div>
  )
}
