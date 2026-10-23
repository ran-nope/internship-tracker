import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Moon,
  Sun,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react'
import { ErrorMessage } from './Feedback'
import Brand from './Brand'
import { routeHref } from '../utils/navigation'

export default function AuthPage({
  tracker,
  theme,
  toggleTheme,
  mode,
  next,
  navigate,
}) {
  const {
    username,
    setUsername,
    password,
    setPassword,
    loading,
    error,
    success,
    handleSubmit,
    setError,
    setSuccess,
  } = tracker
  const isLogin = mode === 'login'
  const [visible, setVisible] = useState(false)
  const [validation, setValidation] = useState({})
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function submit(event) {
    event.preventDefault()
    setError('')
    const errors = {}
    if (!username.trim()) errors.username = 'Please enter your username.'
    if (!password) errors.password = 'Please enter your password.'
    else if (new TextEncoder().encode(password).length > 72)
      errors.password =
        'This password is too long. Try fewer characters or emoji.'
    setValidation(errors)
    if (Object.keys(errors).length) {
      document
        .getElementById(errors.username ? 'username' : 'password')
        ?.focus()
      return
    }
    const result = await handleSubmit(event, mode)
    if (!mounted.current) return
    if (result === 'signup') navigate('login', { next, replace: true })
    if (result === 'login') navigate(next, { replace: true })
  }
  function switchMode(event) {
    if (loading) {
      event.preventDefault()
      return
    }
    setError('')
    setSuccess('')
    setPassword('')
  }
  return (
    <main className="auth-layout" tabIndex={-1}>
      <section
        className="auth-story"
        aria-label="A considered approach to your search"
      >
        <Brand />
        <div className="auth-pitch">
          <span className="section-index">A WORKSPACE FOR WHAT COMES NEXT</span>
          <h2>
            Less scattered.
            <br />
            <span>More intentional.</span>
          </h2>
          <p>
            Your search is a series of small steps.
            <br />
            Give every one a place to belong.
          </p>
          <div className="auth-steps">
            <span>
              <i>01</i>Capture the opportunity.
            </span>
            <span>
              <i>02</i>Keep the story current.
            </span>
            <span>
              <i>03</i>Find your perspective.
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <span className="identity-grid" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          DESIGNED FOR THE LONG GAME.
        </div>
      </section>
      <section className="auth-panel">
        <a className="auth-back" href={routeHref('home')}>
          <ArrowLeft size={15} />
          Back to home
        </a>
        <button
          className="icon-button auth-theme"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
        </button>
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="section-index">
            {isLogin
              ? 'WELCOME TO YOUR WORKSPACE'
              : 'YOUR NEXT CHAPTER STARTS HERE'}
          </span>
          <h1 className="auth-title">
            {isLogin ? 'Good to see you.' : 'Make it your own.'}
          </h1>
          <p>
            {isLogin
              ? 'Log in and pick up where you left off.'
              : 'Create a workspace for your internship search.'}
          </p>
          <ErrorMessage message={error} />
          {success && (
            <div className="message success" role="status">
              <Check size={18} />
              {success}
            </div>
          )}
          <label htmlFor="username">Username</label>
          <input
            id="username"
            placeholder="Username"
            autoComplete="username"
            maxLength={100}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              setValidation((value) => ({ ...value, username: '' }))
            }}
            required
            disabled={loading}
            aria-invalid={!!validation.username}
            aria-describedby={
              validation.username ? 'username-error' : undefined
            }
          />
          {validation.username && (
            <p className="field-error" id="username-error" role="alert">
              {validation.username}
            </p>
          )}
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              placeholder="Password"
              type={visible ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setValidation((value) => ({ ...value, password: '' }))
              }}
              required
              disabled={loading}
              aria-invalid={!!validation.password}
              aria-describedby={
                validation.password
                  ? 'password-error'
                  : !isLogin
                    ? 'password-hint'
                    : undefined
              }
            />
            <button
              type="button"
              className="icon-button"
              disabled={loading}
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {validation.password ? (
            <p className="field-error" id="password-error" role="alert">
              {validation.password}
            </p>
          ) : (
            !isLogin && (
              <p className="field-hint" id="password-hint">
                Choose a unique password you can keep safe.
              </p>
            )
          )}
          <button className="primary-button auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Sign Up'}
            <ArrowUpRight size={18} />
          </button>
          <a
            className="switch-auth"
            href={routeHref(isLogin ? 'signup' : 'login', { next })}
            aria-disabled={loading}
            onClick={switchMode}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : 'Already have an account? Login'}
          </a>
          <div className="auth-footnote">
            <ShieldCheck size={15} />
            <span>Your account. Your applications. Your next step.</span>
          </div>
          <a
            className="auth-product-link"
            href={routeHref('home', { section: 'workspace' })}
          >
            A little more about the workspace
            <ArrowRight size={13} />
          </a>
        </form>
      </section>
    </main>
  )
}
