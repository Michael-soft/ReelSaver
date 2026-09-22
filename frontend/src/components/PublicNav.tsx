import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'

interface PublicNavProps {
  isAuthenticated?: boolean
}

export function PublicNav({ isAuthenticated = false }: PublicNavProps) {
  return (
    <nav className="glass" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.9rem clamp(1rem, 4vw, 2rem)',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <Link to="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        textDecoration: 'none',
        color: 'var(--text)',
      }}>
        <div className="brand-mark" style={{ width: '34px', height: '34px' }}>
          <Download size={18} color="white" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>ReelSaver</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isAuthenticated ? (
          <Link to="/app" className="btn-primary" style={{ textDecoration: 'none' }}>
            Open dashboard
          </Link>
        ) : (
          <>
            <Link to="/login" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Sign in
            </Link>
            <Link to="/login?mode=register" className="btn-primary" style={{ textDecoration: 'none' }}>
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
