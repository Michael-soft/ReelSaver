import { Link } from 'react-router-dom'

export function PublicFooter() {
  const year = new Date().getFullYear()
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '2rem',
      marginTop: 'auto',
      background: 'var(--surface)',
    }}>
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.875rem',
        color: 'var(--muted)',
      }}>
        <div>© {year} ReelSaver. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Home</Link>
          <Link to="/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Privacy</Link>
          <Link to="/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </div>
    </footer>
  )
}
