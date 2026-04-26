import { useState, type FormEvent } from 'react'
import { Download, AlertCircle, Loader2 } from 'lucide-react'

interface LandingPageProps {
  onAuthenticated: () => void
}

type Mode = 'login' | 'register'

export function LandingPage({ onAuthenticated }: LandingPageProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const initialError = (() => {
    const params = new URLSearchParams(window.location.search)
    const e = params.get('auth_error')
    if (!e) return ''
    if (e.startsWith('google')) return 'Google sign-in failed. Please try again.'
    return 'Authentication error. Please try again.'
  })()

  const [showInitialError, setShowInitialError] = useState(!!initialError)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setShowInitialError(false)
    setSubmitting(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login'
        ? { username, password }
        : { username, email: email || undefined, password }
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`)
        return
      }
      window.history.replaceState({}, '', '/')
      onAuthenticated()
    } catch (err) {
      setError((err as Error).message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)', padding: '2rem',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        gap: '1.25rem', maxWidth: '400px', width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '2rem 1.75rem',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={28} color="white" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Seal
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.25rem', marginBottom: 0 }}>
              {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
            </p>
          </div>
        </div>

        <a
          href="/auth/google"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.625rem',
            padding: '0.625rem 1rem',
            background: 'white',
            color: '#1f2937',
            border: '1px solid #d1d5db',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 500, fontSize: '0.9375rem',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              autoComplete={mode === 'login' ? 'username' : 'username'}
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={inputStyle}
              placeholder="yourname"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Email <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder={mode === 'register' ? 'At least 8 characters' : ''}
            />
          </div>

          {(error || (showInitialError && initialError)) && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              padding: '0.625rem 0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '0.8125rem',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error || initialError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.7rem 1rem',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600, fontSize: '0.9375rem',
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              transition: 'opacity 0.15s',
              marginTop: '0.25rem',
            }}
          >
            {submitting && <Loader2 size={16} className="spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: '#a78bfa', cursor: 'pointer', fontWeight: 600,
              fontSize: '0.8125rem',
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '0.375rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
  outline: 'none',
}
