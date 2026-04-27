import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'

interface PublicNavProps {
  isAuthenticated?: boolean
}

export function PublicNav({ isAuthenticated = false }: PublicNavProps) {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1.25rem 2rem',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(15, 15, 20, 0.85)',
      backdropFilter: 'blur(8px)',
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
        <div style={{
          width: '34px', height: '34px',
          background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Download size={18} color="white" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>ReelSaver</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isAuthenticated ? (
          <Link to="/app" style={{
            padding: '0.55rem 1.1rem',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            color: 'white',
            textDecoration: 'none',
            fontSize: '0.9375rem',
            fontWeight: 600,
            borderRadius: '10px',
          }}>
            Open dashboard
          </Link>
        ) : (
          <>
            <Link to="/login" style={{
              padding: '0.5rem 1rem',
              color: 'var(--text)',
              textDecoration: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
              borderRadius: '8px',
            }}>
              Sign in
            </Link>
            <Link to="/login?mode=register" style={{
              padding: '0.55rem 1.1rem',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.9375rem',
              fontWeight: 600,
              borderRadius: '10px',
            }}>
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
